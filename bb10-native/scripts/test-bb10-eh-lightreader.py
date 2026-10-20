#!/usr/bin/env python3
"""Offline source tests. A passing result does NOT mean Q20 installation succeeds."""
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
base=ROOT/"clients/bb10/eh-lightreader-native"
cpp=(base/"src/ehlrbackend.cpp").read_text(encoding="utf8")
qml=(base/"assets/main.qml").read_text(encoding="utf8")
build=(ROOT/"scripts/build-bb10-eh-lightreader.sh").read_text(encoding="utf8")
d=ET.parse(base/"bar-descriptor.xml").getroot()
ns={"q":"http://www.qnx.com/schemas/application/1.0"}
assert d.find("q:id",ns).text=="com.heberry.ehlightreader"
assert d.find("q:versionNumber",ns).text=="0.1.0"
assert [x.text for x in d.findall("q:permission",ns)]==["run_native","access_internet"]
assert "WebView" not in qml and "WebView" not in cpp
assert "import bb.cascades 1.3" in qml
assert "GridListLayout { columnCount: 2 }" in qml
assert "ScrollView {" in qml
assert "imageSource: _eh.currentImage" in qml
assert "onKeyPressed" in qml
assert "ignoreSslErrors()" not in cpp
assert 'ORIGIN("https://eh-lightreader-cloud.hexiangyu481.workers.dev")' in cpp
for p in ["/api/search","/api/catalog","/api/page"]: assert p in cpp,p
for p in ["upstream_rate_limited","upstream_access_denied","upstream_challenge"]: assert p in cpp,p
assert "QSettings" in cpp
assert "QImageReader" in cpp
assert "if(!permittedImage(image))" in cpp
assert "MAX_IMAGE=8*1024*1024" in cpp
assert "bb10-build /src" in build
assert "EH_LightReader_BB10_0.1.0.bar" in build
assert "com.heberry.ehlightreader" in build
print("PASS: EH native package/security/source contracts")
