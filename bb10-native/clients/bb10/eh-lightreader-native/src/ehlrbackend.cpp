#include "ehlrbackend.h"
#include <bb/data/JsonDataAccess>
#include <QtNetwork/QNetworkReply>
#include <QtNetwork/QNetworkRequest>
#include <QUrl>
#include <QDir>
#include <QFile>
#include <QFileInfoList>
#include <QImage>
#include <QImageReader>
#include <QBuffer>
#include <QCryptographicHash>
#include <QDateTime>
#include <QTimer>
#include <QtNetwork/QHostAddress>
#include <QRegExp>
#include <QVariantMap>
#include <QSize>

static const QString ORIGIN("https://eh-lightreader-cloud.hexiangyu481.workers.dev");
static const int MAX_JSON=2*1024*1024;
static const int MAX_IMAGE=8*1024*1024;

static bool isGallery(const QString &gid, const QString &token) {
    return QRegExp("^[0-9]{1,12}$").exactMatch(gid)
      && QRegExp("^[a-zA-Z0-9]{6,64}$").exactMatch(token);
}

EhlrBackend::EhlrBackend(QObject *parent):
    QObject(parent),m_settings("HE Berry","EH LightReader"),
    m_status("准备连接 EH Cloud"),m_category(0),m_searchPage(1),m_index(0),
    m_dir(0),m_dirCount(1),m_generation(0),m_busy(false),
    m_continuous(m_settings.value("reader/continuous",true).toBool()),m_thumbRunning(false) {
    m_cache=QDir::homePath()+"/data/eh-lightreader-cache";
    QDir().mkpath(m_cache);
}
EhlrBackend::~EhlrBackend() {}

void EhlrBackend::setStatus(const QString &msg, bool busy) {
    m_status=msg;m_busy=busy;emit changed();
}

void EhlrBackend::fetch(const QString &uri, const QString &kind, int index, int generation) {
    const QUrl url(uri);
    if(url.scheme().toLower()!="https" || url.port()!=-1 || !url.userInfo().isEmpty()) {
        setStatus("拒绝不安全的 HTTPS 地址",false);return;
    }
    QNetworkRequest request(url);
    request.setRawHeader("Accept",(kind=="image" || kind=="thumb")?"image/*":"application/json");
    request.setRawHeader("User-Agent","EH-LightReader-Q20/0.1.0");
    QNetworkReply *reply=m_net.get(request);
    reply->setProperty("kind",kind);reply->setProperty("index",index);
    reply->setProperty("generation",generation);
    connect(reply,SIGNAL(finished()),this,SLOT(finished()));
    connect(reply,SIGNAL(sslErrors(QList<QSslError>)),this,SLOT(sslFailure(QList<QSslError>)));
    QTimer::singleShot(18000,reply,SLOT(abort()));
}

void EhlrBackend::sslFailure(const QList<QSslError> &errors) {
    Q_UNUSED(errors);
    // Never waive certificate verification. Fail closed if BB10 cannot validate Cloudflare.
    setStatus("BB10 TLS 证书校验失败，未绕过验证",false);
}

void EhlrBackend::search(const QString &q,int category,int page) {
    if(page<1 || page>500 || q.length()>180) {setStatus("搜索参数超出范围",false);return;}
    if(!(category==0||category==2||category==4||category==8||category==16||
         category==32||category==64||category==128||category==256||category==512)) return;
    m_query=q.trimmed();m_category=category;m_searchPage=page;
    ++m_generation;m_thumbnailQueue.clear();m_thumbRunning=false;
    QUrl u(ORIGIN+"/api/search");
    u.addQueryItem("q",m_query);
    u.addQueryItem("category",QString::number(category));
    u.addQueryItem("page",QString::number(page));
    setStatus("正在搜索…",true);
    fetch(u.toString(),"search",0,m_generation);
}
void EhlrBackend::searchNext(){search(m_query,m_category,m_searchPage+1);}

void EhlrBackend::openGallery(const QString &gid,const QString &token,const QString &title) {
    if(!isGallery(gid,token)){setStatus("作品链接无效",false);return;}
    ++m_generation;
    m_gid=gid;m_token=token;m_title=title.left(160);m_index=0;
    m_dir=0;m_dirCount=1;m_pages.clear();m_images.clear();
    m_currentImage.clear();m_nextImage.clear();
    setStatus("正在读取漫画目录…",true);
    catalog(0);
}
void EhlrBackend::catalog(int directory) {
    QUrl u(ORIGIN+"/api/catalog");
    u.addQueryItem("gid",m_gid);u.addQueryItem("token",m_token);
    u.addQueryItem("p",QString::number(directory));
    fetch(u.toString(),"catalog",directory,m_generation);
}

QString EhlrBackend::progressKey()const{return "progress/"+m_gid+"-"+m_token;}

void EhlrBackend::pageBy(int delta){
    if(delta!=1&&delta!=-1)return;
    const int target=m_index+delta;
    if(target<0)return;
    if(target>=m_pages.size()){
        if(m_dir+1<m_dirCount){setStatus("正在加载后续目录…",true);catalog(m_dir+1);}
        return;
    }
    m_index=target;
    m_settings.setValue(progressKey(),m_index);
    m_currentImage=m_images.value(m_index);
    m_nextImage=m_images.value(m_index+1);
    emit changed();
    if(m_currentImage.isEmpty())resolve(m_index);
    else setStatus("阅读就绪",false);
    if(m_continuous && m_currentImage.length() && m_nextImage.isEmpty() &&
       m_index+1<m_pages.size()) resolve(m_index+1);
}

void EhlrBackend::resolve(int index){
    if(index<0||index>=m_pages.size())return;
    const QString page=m_pages.at(index).toMap().value("url").toString();
    if(!page.startsWith("https://e-hentai.org/s/"))return;
    QUrl u(ORIGIN+"/api/page");
    u.addQueryItem("url",page);
    setStatus("读取第 "+QString::number(index+1)+" 页…",true);
    fetch(u.toString(),"page",index,m_generation);
}

bool EhlrBackend::permittedImage(const QString &value) const {
    const QUrl url(value);
    if(url.scheme().toLower()!="https"||url.port()!=-1||!url.userInfo().isEmpty())return false;
    const QString host=url.host().toLower();
    QHostAddress ip;
    if(ip.setAddress(host))return false;
    // Only image CDNs normally returned by the public EH gallery API.
    return host=="ehgt.org"||host.endsWith(".ehgt.org")||
      host=="hath.network"||host.endsWith(".hath.network")||
      host=="e-hentai.org"||host.endsWith(".e-hentai.org");
}

void EhlrBackend::downloadImage(const QString &url,const QString &kind,int index){
    if(!permittedImage(url)){
        if(kind!="thumb")setStatus("图片域名不在允许的 HTTPS 列表",false);
        return;
    }
    fetch(url,kind,index,m_generation);
}

QString EhlrBackend::saveImage(const QByteArray &data,int index,bool thumb){
    QBuffer buffer;
    buffer.setData(data);
    if(!buffer.open(QIODevice::ReadOnly))return QString();
    QImageReader r(&buffer);
    const QSize orig=r.size();
    if(!orig.isValid()||orig.width()>20000||orig.height()>30000||
       qint64(orig.width())*orig.height()>40000000LL)return QString();
    const QSize budget=thumb?QSize(280,420):QSize(720,9000);
    r.setScaledSize(orig.scaled(budget,Qt::KeepAspectRatio));
    const QImage image=r.read();
    if(image.isNull())return QString();
    const QString key=thumb?
      QString("thumb-%1-%2").arg(m_searchPage).arg(index):
      QString("page-%1-%2-%3").arg(m_gid).arg(m_token).arg(index);
    const QString hash=QString::fromLatin1(QCryptographicHash::hash(key.toUtf8(),
        QCryptographicHash::Sha1).toHex());
    const QString path=m_cache+"/"+(thumb?"t_":"r_")+hash+".jpg";
    const QString temp=path+".part";
    if(!image.save(temp,"JPEG",thumb?72:82))return QString();
    QFile::remove(path);
    if(!QFile::rename(temp,path)){QFile::remove(temp);return QString();}
    return QUrl::fromLocalFile(path).toString();
}

void EhlrBackend::trimFiles() {
    // Retain current and next full-size compressed image; no persistent full-book cache.
    QDir dir(m_cache);
    QFileInfoList images=dir.entryInfoList(QStringList("r_*.jpg"),QDir::Files,QDir::Time);
    for(int i=4;i<images.size();++i)QFile::remove(images.at(i).absoluteFilePath());
    QFileInfoList thumbs=dir.entryInfoList(QStringList("t_*.jpg"),QDir::Files,QDir::Time);
    for(int i=24;i<thumbs.size();++i)QFile::remove(thumbs.at(i).absoluteFilePath());
}

void EhlrBackend::setImage(int index,const QString &path){
    m_images[index]=path;
    if(index==m_index)m_currentImage=path;
    if(index==m_index+1)m_nextImage=path;
    setStatus("阅读就绪",false);
    trimFiles();
    if(index==m_index && m_continuous && index+1<m_pages.size() &&
        !m_images.contains(index+1))resolve(index+1);
}
void EhlrBackend::thumbs(){
    if(m_thumbRunning||m_thumbnailQueue.isEmpty())return;
    const QPair<int,QString> row=m_thumbnailQueue.takeFirst();
    m_thumbRunning=true;downloadImage(row.second,"thumb",row.first);
}
QString EhlrBackend::errorText(const QString &code)const{
    if(code=="upstream_rate_limited")return "原站限流，已停止请求";
    if(code=="upstream_access_denied")return "原站拒绝访问";
    if(code=="upstream_challenge")return "原站要求验证，已停止访问";
    if(code=="upstream_network_error")return "云端无法连接原站";
    if(code=="catalog_unavailable")return "漫画目录暂时不可用";
    if(code=="image_not_found")return "无法解析本页图片";
    return "接口错误："+code.left(90);
}

void EhlrBackend::finished(){
    QNetworkReply *reply=qobject_cast<QNetworkReply*>(sender());
    if(!reply)return;
    const QString kind=reply->property("kind").toString();
    const int index=reply->property("index").toInt();
    const int generation=reply->property("generation").toInt();
    const int http=reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    const QNetworkReply::NetworkError err=reply->error();
    const QByteArray bytes=reply->readAll();
    reply->deleteLater();
    if(kind=="thumb")m_thumbRunning=false;
    if(generation!=m_generation){if(kind=="thumb")thumbs();return;}
    if(err!=QNetworkReply::NoError || http==0 || http>=300 ||
       bytes.size()>((kind=="thumb"||kind=="image")?MAX_IMAGE:MAX_JSON)){
        if(kind=="thumb"){thumbs();return;}
        setStatus(http==429?"请求被限流，未自动重试":
                  http==403?"原站拒绝访问":
                  QString("网络或下载失败（HTTP %1）").arg(http),false);
        return;
    }
    if(kind=="thumb"||kind=="image"){
        const QString file=saveImage(bytes,index,kind=="thumb");
        if(kind=="thumb"){if(!file.isEmpty())emit thumbReady(index,file);thumbs();}
        else if(!file.isEmpty())setImage(index,file);
        else setStatus("原生图片解码失败",false);
        return;
    }
    bb::data::JsonDataAccess json;
    const QVariantMap data=json.loadFromBuffer(bytes).toMap();
    if(!data.value("ok").toBool()){
        setStatus(errorText(data.value("error").toString()),false);return;
    }
    if(kind=="search"){
        m_results=data.value("items").toList();
        for(int i=0;i<m_results.size();++i){
            const QVariantMap v=m_results.at(i).toMap();
            const QString thumb=v.value("cover").toString();
            if(permittedImage(thumb)&&m_thumbnailQueue.size()<24)
                m_thumbnailQueue.append(qMakePair(i,thumb));
        }
        emit searchReady(m_results);
        setStatus(QString("搜索到 %1 项").arg(m_results.size()),false);
        thumbs();
    }else if(kind=="catalog"){
        const QVariantList pages=data.value("pages").toList();
        if(index==0){
            m_pages=pages;
            const int previous=m_settings.value(progressKey(),0).toInt();
            m_index=qBound(0,previous,qMax(0,m_pages.size()-1));
            saveHistory();
        }else{
            for(int i=0;i<pages.size();++i){
                const QVariantMap p=pages.at(i).toMap();
                bool seen=false;
                for(int j=0;j<m_pages.size();++j)
                    if(m_pages.at(j).toMap().value("page")==p.value("page"))seen=true;
                if(!seen)m_pages.append(p);
            }
        }
        m_dir=index;
        m_dirCount=qMax(m_dirCount,data.value("directory_pages",1).toInt());
        if(m_pages.isEmpty()){setStatus("目录为空",false);return;}
        emit catalogReady();
        emit changed();
        if(!m_images.value(m_index).isEmpty()){
            m_currentImage=m_images.value(m_index);
            setStatus("阅读就绪",false);
        }else resolve(m_index);
    }else if(kind=="page"){
        const QString image=data.value("image_url").toString();
        if(!permittedImage(image)){
            setStatus("云端返回了不受信任的图片地址",false);return;
        }
        downloadImage(image,"image",index);
    }
}
QVariantList EhlrBackend::list(const QString &key)const{
    return m_settings.value(key).toList();
}
void EhlrBackend::saveHistory(){
    QVariantList history=list("history");
    const QString key=m_gid+"-"+m_token;
    for(int i=history.size()-1;i>=0;--i)
        if(history.at(i).toMap().value("gid").toString()+"-"+
           history.at(i).toMap().value("token").toString()==key)history.removeAt(i);
    QVariantMap row;row["gid"]=m_gid;row["token"]=m_token;row["title"]=m_title;
    row["savedAt"]=QDateTime::currentDateTime().toString(Qt::ISODate);
    history.prepend(row);
    while(history.size()>100)history.removeLast();
    m_settings.setValue("history",history);
}
bool EhlrBackend::favorite()const{
    const QVariantList shelf=list("shelf");
    for(int i=0;i<shelf.size();++i){
        const QVariantMap m=shelf.at(i).toMap();
        if(m.value("gid").toString()==m_gid && m.value("token").toString()==m_token)
            return true;
    }
    return false;
}
void EhlrBackend::toggleFavorite(){
    if(!isGallery(m_gid,m_token))return;
    const bool wasSaved=favorite();
    QVariantList shelf=list("shelf");
    for(int i=shelf.size()-1;i>=0;--i){
        const QVariantMap v=shelf.at(i).toMap();
        if(v.value("gid").toString()==m_gid&&v.value("token").toString()==m_token)
            shelf.removeAt(i);
    }
    if(!wasSaved){
        QVariantMap row;row["gid"]=m_gid;row["token"]=m_token;row["title"]=m_title;
        row["savedAt"]=QDateTime::currentDateTime().toString(Qt::ISODate);
        shelf.prepend(row);
    }
    while(shelf.size()>100)shelf.removeLast();
    m_settings.setValue("shelf",shelf);emit changed();
}
void EhlrBackend::loadSaved(bool history){emit savedReady(list(history?"history":"shelf"));}
void EhlrBackend::setContinuous(bool yes){
    m_continuous=yes;
    m_settings.setValue("reader/continuous",yes);
    emit changed();
    if(yes && m_currentImage.length() && m_nextImage.isEmpty() &&
       m_index+1<m_pages.size())resolve(m_index+1);
}
void EhlrBackend::retryPage(){if(m_index<m_pages.size())resolve(m_index);}
void EhlrBackend::closeReader(){
    ++m_generation;m_pages.clear();m_images.clear();m_currentImage.clear();
    m_nextImage.clear();m_thumbnailQueue.clear();
    setStatus("已返回首页",false);
}
