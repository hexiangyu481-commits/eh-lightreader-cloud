#include <bb/cascades/Application>
#include <bb/cascades/QmlDocument>
#include <bb/cascades/AbstractPane>
#include "ehlrbackend.h"
using namespace bb::cascades;
Q_DECL_EXPORT int main(int argc, char **argv) {
    Application app(argc,argv);
    EhlrBackend backend(&app);
    QmlDocument *doc=QmlDocument::create("asset:///main.qml").parent(&app);
    doc->setContextProperty("_eh",&backend);
    if(doc->hasErrors()) return 1;
    AbstractPane *root=doc->createRootObject<AbstractPane>();
    if(!root) return 2;
    app.setScene(root);
    return Application::exec();
}
