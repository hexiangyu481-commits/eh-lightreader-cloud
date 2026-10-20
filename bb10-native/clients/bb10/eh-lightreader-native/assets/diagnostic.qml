import bb.cascades 1.3

Page {
    Container {
        layout: StackLayout {}
        horizontalAlignment: HorizontalAlignment.Fill
        verticalAlignment: VerticalAlignment.Fill
        background: Color.create("#10121A")
        leftPadding: 18
        rightPadding: 18
        topPadding: 24
        bottomPadding: 24

        Label {
            text: "EH 轻阅读 · 启动诊断"
            multiline: true
            textStyle.fontSize: FontSize.Large
            textStyle.color: Color.create("#F0EAFE")
        }
        Label {
            text: "应用进程已启动，但主界面未能创建。请拍下下方错误信息发给开发者。"
            multiline: true
            textStyle.fontSize: FontSize.Small
            textStyle.color: Color.create("#CBB6DF")
        }
        Label {
            text: _startupError
            multiline: true
            textStyle.fontSize: FontSize.XSmall
            textStyle.color: Color.create("#FFFFFF")
        }
    }
}
