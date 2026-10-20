#ifndef EHLR_BACKEND_H
#define EHLR_BACKEND_H
#include <QObject>
#include <QNetworkAccessManager>
#include <QSslError>
#include <QSettings>
#include <QString>
#include <QVariantList>
#include <QMap>
#include <QList>
#include <QPair>

class QNetworkReply;

// BB10 Cascades data + HTTPS backend. No WebView / browser runtime.
class EhlrBackend : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString status READ status NOTIFY changed)
    Q_PROPERTY(QString title READ title NOTIFY changed)
    Q_PROPERTY(QString currentImage READ currentImage NOTIFY changed)
    Q_PROPERTY(QString nextImage READ nextImage NOTIFY changed)
    Q_PROPERTY(int currentPage READ currentPage NOTIFY changed)
    Q_PROPERTY(int pageCount READ pageCount NOTIFY changed)
    Q_PROPERTY(bool busy READ busy NOTIFY changed)
    Q_PROPERTY(bool continuous READ continuous NOTIFY changed)
    Q_PROPERTY(bool favorite READ favorite NOTIFY changed)
public:
    explicit EhlrBackend(QObject *parent=0);
    virtual ~EhlrBackend();

    QString status() const {return m_status;}
    QString title() const {return m_title;}
    QString currentImage() const {return m_currentImage;}
    QString nextImage() const {return m_nextImage;}
    int currentPage() const {return m_index+1;}
    int pageCount() const {return m_pages.size();}
    bool busy() const {return m_busy;}
    bool continuous() const {return m_continuous;}
    bool favorite() const;

    Q_INVOKABLE void search(const QString &query, int category, int page);
    Q_INVOKABLE void searchNext();
    Q_INVOKABLE void openGallery(const QString &gid, const QString &token, const QString &title);
    Q_INVOKABLE void pageBy(int delta);
    Q_INVOKABLE void setContinuous(bool continuous);
    Q_INVOKABLE void toggleFavorite();
    Q_INVOKABLE void loadSaved(bool history);
    Q_INVOKABLE void closeReader();
    Q_INVOKABLE void retryPage();
    Q_INVOKABLE QString version() const {return "0.1.0";}

Q_SIGNALS:
    void changed();
    void searchReady(const QVariantList &items);
    void savedReady(const QVariantList &items);
    void catalogReady();
    void thumbReady(int index, const QString &path);

private Q_SLOTS:
    void finished();
    void sslFailure(const QList<QSslError> &errors);

private:
    void fetch(const QString &uri, const QString &kind, int index, int generation);
    void catalog(int directory);
    void resolve(int index);
    void downloadImage(const QString &url, const QString &kind, int index);
    void thumbs();
    void setStatus(const QString &msg, bool busy);
    void setImage(int index, const QString &path);
    QString saveImage(const QByteArray &bytes, int index, bool thumb);
    QString progressKey() const;
    bool permittedImage(const QString &url) const;
    void saveHistory();
    QVariantList list(const QString &key) const;
    QString errorText(const QString &code) const;
    void trimFiles();

    QNetworkAccessManager m_net;
    QSettings m_settings;
    QString m_status,m_title,m_gid,m_token,m_query,m_currentImage,m_nextImage,m_cache;
    int m_category,m_searchPage,m_index,m_dir,m_dirCount,m_generation;
    bool m_busy,m_continuous,m_thumbRunning;
    QVariantList m_pages,m_results;
    QList<QPair<int,QString> > m_thumbnailQueue;
    QMap<int,QString> m_images;
};
#endif
