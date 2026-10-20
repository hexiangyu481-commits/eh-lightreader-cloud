import bb.cascades 1.3

// EH LightReader / Q20: every visible control is a native Cascades item.
// No browser widget, Userscripts, iframe, remote HTML or JavaScript browser engine.
Page {
    id: root
    property int view: 0 // 0 discovery, 1 shelf/history, 2 reader
    property bool historyTab: false
    property int queryCategory: 0
    property real touchX: 0
    property real touchY: 0
    property bool trackingTouch: false

    function renderEntries(items) {
        comicModel.clear()
        for (var i = 0; i < items.length; i++) {
            var entry = items[i]
            if (!entry.coverLocal) entry.coverLocal = ""
            comicModel.append(entry)
        }
    }
    function showSaved(history) {
        view = 1
        historyTab = history
        _eh.loadSaved(history)
    }
    function showSearch(category) {
        view = 0
        queryCategory = category
        _eh.search(queryBox.text, category, 1)
    }
    function activate(item) {
        var gid = String(item.gid)
        _eh.openGallery(gid, String(item.token), String(item.title || "漫画"))
    }

    onCreationCompleted: {
        _eh.searchReady.connect(function(items) {
            root.view = 0
            root.renderEntries(items)
        })
        _eh.savedReady.connect(function(items) {
            root.renderEntries(items)
        })
        _eh.catalogReady.connect(function() {
            root.view = 2
        })
        _eh.thumbReady.connect(function(index, path) {
            if (root.view !== 0 || index < 0 || index >= comicModel.size()) return
            var original = comicModel.data([index])
            if (!original) return
            original.coverLocal = path
            comicModel.replace(index, original)
        })
        _eh.search("language:chinese$", 0, 1)
    }

    keyListeners: [
        KeyListener {
            onKeyPressed: {
                if (root.view !== 2) return
                if (event.key === 65) _eh.pageBy(-1)
                if (event.key === 68) _eh.pageBy(1)
            }
        }
    ]

    Container {
        layout: StackLayout {}
        horizontalAlignment: HorizontalAlignment.Fill
        verticalAlignment: VerticalAlignment.Fill
        background: Color.create("#10121A")

        Container {
            horizontalAlignment: HorizontalAlignment.Fill
            background: Color.create("#211A30")
            leftPadding: 15
            rightPadding: 15
            topPadding: 12
            bottomPadding: 10
            Label {
                text: root.view === 2 ? (_eh.title || "漫画阅读") : "EH 轻阅读 · BB10"
                textStyle.fontSize: FontSize.Medium
                textStyle.color: Color.create("#F0EAFE")
                multiline: true
            }
            Label {
                text: root.view === 2
                    ? "原生阅读 · " + _eh.currentPage + " / " + _eh.pageCount
                    : "Cascades Native 0.1.0 · EH Cloud"
                textStyle.fontSize: FontSize.XSmall
                textStyle.color: Color.create("#BDABD7")
            }
        }

        Container {
            visible: root.view !== 2
            horizontalAlignment: HorizontalAlignment.Fill
            leftPadding: 12
            rightPadding: 12
            topPadding: 8
            layout: StackLayout {
                orientation: LayoutOrientation.LeftToRight
            }
            Button {
                text: "发现"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: root.showSearch(root.queryCategory)
            }
            Button {
                text: "书架"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: root.showSaved(false)
            }
            Button {
                text: "历史"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: root.showSaved(true)
            }
        }

        Container {
            visible: root.view === 0
            horizontalAlignment: HorizontalAlignment.Fill
            leftPadding: 12
            rightPadding: 12
            topPadding: 4
            bottomPadding: 7
            TextField {
                id: queryBox
                hintText: "中文标题或标签"
                text: "language:chinese$"
                textStyle.fontSize: FontSize.Medium
                onSubmitted: root.showSearch(root.queryCategory)
            }
            Container {
                layout: StackLayout {
                    orientation: LayoutOrientation.LeftToRight
                }
                DropDown {
                    id: category
                    title: "分类"
                    layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                    options: [
                        Option { text: "全部"; value: 0; selected: true },
                        Option { text: "同人志"; value: 2 },
                        Option { text: "漫画"; value: 4 },
                        Option { text: "画师 CG"; value: 8 },
                        Option { text: "游戏 CG"; value: 16 },
                        Option { text: "图集"; value: 32 },
                        Option { text: "Cosplay"; value: 64 },
                        Option { text: "非成人"; value: 256 }
                    ]
                    onSelectedValueChanged: root.queryCategory = selectedValue
                }
                Button {
                    text: "搜索"
                    onClicked: root.showSearch(root.queryCategory)
                }
            }
        }

        // Q20 720 x 720 screen: use a native two-column GridListLayout.
        ListView {
            id: comicGrid
            visible: root.view !== 2
            horizontalAlignment: HorizontalAlignment.Fill
            verticalAlignment: VerticalAlignment.Fill
            layoutProperties: StackLayoutProperties { spaceQuota: 1 }
            layout: GridListLayout { columnCount: 2 }
            dataModel: ArrayDataModel { id: comicModel }
            listItemComponents: [
                ListItemComponent {
                    type: ""
                    Container {
                        preferredWidth: 345
                        leftPadding: 7
                        rightPadding: 7
                        topPadding: 7
                        bottomPadding: 8
                        background: Color.create("#262036")
                        ImageView {
                            preferredWidth: 320
                            preferredHeight: 235
                            horizontalAlignment: HorizontalAlignment.Fill
                            scalingMethod: ScalingMethod.AspectFit
                            imageSource: ListItemData.coverLocal || ""
                            visible: !!ListItemData.coverLocal
                        }
                        Label {
                            visible: !ListItemData.coverLocal
                            text: "EH\n封面待加载"
                            multiline: true
                            horizontalAlignment: HorizontalAlignment.Center
                            textStyle.color: Color.create("#9F8BC2")
                            textStyle.fontSize: FontSize.Small
                        }
                        Label {
                            text: ListItemData.title || "无标题"
                            multiline: true
                            textStyle.fontSize: FontSize.Small
                            textStyle.color: Color.create("#EDE6F6")
                        }
                        Label {
                            text: (ListItemData.category || "漫画") +
                                  (ListItemData.pages ? " · " + ListItemData.pages + " 页" : "")
                            textStyle.fontSize: FontSize.XSmall
                            textStyle.color: Color.create("#B8A8C5")
                        }
                    }
                }
            ]
            onTriggered: {
                var item = comicModel.data(indexPath)
                if (item) root.activate(item)
            }
        }

        Container {
            visible: root.view === 0
            horizontalAlignment: HorizontalAlignment.Fill
            leftPadding: 12
            rightPadding: 12
            Button {
                horizontalAlignment: HorizontalAlignment.Fill
                text: "下一页搜索结果"
                onClicked: _eh.searchNext()
            }
        }

        // Reader: native Cascades ScrollView, not a rendered webpage.
        Container {
            visible: root.view === 2
            horizontalAlignment: HorizontalAlignment.Fill
            leftPadding: 12
            rightPadding: 12
            topPadding: 7
            layout: StackLayout {
                orientation: LayoutOrientation.LeftToRight
            }
            Button {
                text: "‹ 返回"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: {
                    _eh.closeReader()
                    root.showSearch(root.queryCategory)
                }
            }
            Button {
                text: _eh.continuous ? "↓ 连续" : "⇆ 翻页"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: _eh.setContinuous(!_eh.continuous)
            }
            Button {
                text: _eh.favorite ? "♥ 已藏" : "♡ 收藏"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: _eh.toggleFavorite()
            }
        }

        ScrollView {
            id: pictureScroll
            visible: root.view === 2
            horizontalAlignment: HorizontalAlignment.Fill
            verticalAlignment: VerticalAlignment.Fill
            layoutProperties: StackLayoutProperties { spaceQuota: 1 }
            scrollViewProperties {
                scrollMode: ScrollMode.Vertical
                pinchToZoomEnabled: false
            }
            Container {
                background: Color.create("#131018")
                horizontalAlignment: HorizontalAlignment.Fill
                layout: StackLayout {}

                Label {
                    horizontalAlignment: HorizontalAlignment.Center
                    text: _eh.currentImage ? "" : "正在等待原生图片解码…"
                    textStyle.color: Color.create("#AA9AB6")
                }
                ImageView {
                    id: currentPageImage
                    visible: _eh.currentImage.length > 0
                    horizontalAlignment: HorizontalAlignment.Fill
                    scalingMethod: ScalingMethod.AspectFit
                    imageSource: _eh.currentImage
                    onTouch: {
                        if (_eh.continuous) return
                        if (event.isDown()) {
                            root.touchX = event.localX
                            root.touchY = event.localY
                            root.trackingTouch = true
                        } else if (event.isUp() && root.trackingTouch) {
                            var dx = event.localX - root.touchX
                            var dy = event.localY - root.touchY
                            root.trackingTouch = false
                            if (Math.abs(dx) > 110 && Math.abs(dx) > Math.abs(dy) * 1.5)
                                _eh.pageBy(dx < 0 ? 1 : -1)
                        }
                    }
                }
                ImageView {
                    visible: _eh.continuous && _eh.nextImage.length > 0
                    horizontalAlignment: HorizontalAlignment.Fill
                    scalingMethod: ScalingMethod.AspectFit
                    imageSource: _eh.nextImage
                }
            }
        }

        Container {
            visible: root.view === 2
            horizontalAlignment: HorizontalAlignment.Fill
            background: Color.create("#211A30")
            leftPadding: 10
            rightPadding: 10
            topPadding: 5
            bottomPadding: 8
            layout: StackLayout {
                orientation: LayoutOrientation.LeftToRight
            }
            Button {
                text: "‹ A"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: _eh.pageBy(-1)
            }
            Button {
                text: "重试"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: _eh.retryPage()
            }
            Button {
                text: "D ›"
                layoutProperties: StackLayoutProperties { spaceQuota: 1 }
                onClicked: _eh.pageBy(1)
            }
        }

        Label {
            horizontalAlignment: HorizontalAlignment.Fill
            text: _eh.status
            textStyle.fontSize: FontSize.XSmall
            textStyle.color: Color.create("#CBB6DF")
            multiline: true
            leftMargin: 14
            bottomMargin: 12
        }
    }
}
