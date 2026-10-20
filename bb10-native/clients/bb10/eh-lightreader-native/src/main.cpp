#include <bb/cascades/Application>
#include <bb/cascades/QmlDocument>
#include <bb/cascades/AbstractPane>
#include <QtDeclarative/QDeclarativeError>
#include <QStringList>
#include <QDebug>
#include "ehlrbackend.h"

using namespace bb::cascades;

static QString collectQmlErrors(QmlDocument *document, const QString &fallback) {
    QStringList lines;
    if (document) {
        foreach (const QDeclarativeError &error, document->errors()) {
            const QString line = error.toString();
            qWarning() << "EH LightReader QML error:" << line;
            lines << line;
        }
    }
    if (lines.isEmpty()) lines << fallback;
    return lines.join("\n");
}

static AbstractPane *createDiagnostic(Application *app, const QString &message) {
    QmlDocument *diagnostic = QmlDocument::create("asset:///diagnostic.qml").parent(app);
    diagnostic->setContextProperty("_startupError", message);
    if (diagnostic->hasErrors()) {
        qWarning() << "EH LightReader diagnostic QML failed to load";
        foreach (const QmlError &error, diagnostic->errors()) qWarning() << error.toString();
        return 0;
    }
    AbstractPane *root = diagnostic->createRootObject<AbstractPane>();
    if (!root) qWarning() << "EH LightReader diagnostic root is null";
    return root;
}

Q_DECL_EXPORT int main(int argc, char **argv) {
    Application app(argc, argv);
    qWarning() << "EH LightReader 0.1.0.3: process started";

    EhlrBackend backend(&app);
    QmlDocument *doc = QmlDocument::create("asset:///main.qml").parent(&app);
    doc->setContextProperty("_eh", &backend);

    if (doc->hasErrors()) {
        const QString errors = collectQmlErrors(doc, "主界面 QML 加载失败，但系统未提供具体错误。");
        AbstractPane *diagnostic = createDiagnostic(&app, errors);
        if (!diagnostic) return 1;
        app.setScene(diagnostic);
        return Application::exec();
    }

    AbstractPane *root = doc->createRootObject<AbstractPane>();
    if (!root) {
        const QString errors = collectQmlErrors(doc, "主界面根对象创建失败；未返回具体 QML 错误。");
        AbstractPane *diagnostic = createDiagnostic(&app, errors);
        if (!diagnostic) return 2;
        app.setScene(diagnostic);
        return Application::exec();
    }

    qWarning() << "EH LightReader 0.1.0.3: main QML root created";
    app.setScene(root);
    return Application::exec();
}
