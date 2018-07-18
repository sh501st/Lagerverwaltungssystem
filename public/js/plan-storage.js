// TODO: should be fetched from the css for consistency reasons
const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    BORDER: '#606060',
    ACCESS: '#ee3060',
    OPTIMIZED: '#3b8c1d',
    HIGHLIGHT: '#30aaee',
});

let defaultStorage, optimizedStorage, cols, rows;
let stage, defaultLayer, optimizedLayer;
let socket, sessionID;
let accessSlider;

const tileSize = 32;

function main() {
    setupAccessSlider();
    sessionID = readFromSessionStorage('sessionID');
    connectToServer().then(() => {
        requestAccessSliderRange();
    });
}

// slider range is updated to unix timestamp min and max values once
// the server connection is established
function setupAccessSlider() {
    accessSlider = document.getElementById('accessSlider');
    noUiSlider.create(accessSlider, {
        start: [0, 10],
        connect: true,
        orientation: 'horizontal',
        tooltips: [false, false],
        step: 1,
        padding: 1,
        range: { 'min': 0, 'max': 10 },
        format: {
            to: (val) => new Date(val * 1000).toISOString(),
            from: (val) => val
        }
    });
    accessSlider.setAttribute('disabled', true);
    accessSlider.noUiSlider.on('change', () => {
        accessSlider.setAttribute('disabled', true);
        const [minTime, maxTime] = getSliderMinMaxValues();
        setTimeRangeLabels(minTime, maxTime);
        requestOptimizedStorageSetupPreview(minTime, maxTime);
    });
}

// set time tange labels associated with the access range slider.
// minTime and maxTime are unix timestamps
function setTimeRangeLabels(minTime, maxTime) {
    document.getElementById('accessSliderlabel_from').innerHTML =
        new Date(minTime * 1000).toLocaleString('de-DE');
    document.getElementById('accessSliderlabel_to').innerHTML =
        new Date(maxTime * 1000).toLocaleString('de-DE');
}

function getSliderMinMaxValues() {
    if (accessSlider && accessSlider.noUiSlider) {
        const vals = accessSlider.noUiSlider.get();
        return [new Date(vals[0]).valueOf() / 1000,
                new Date(vals[1]).valueOf() / 1000];
    } else {
        return [0, 10];
    }
}

// initialize the canvas and setup all the graphical fluff; will also
// be called once we receive an optimized storage preview from the
// server to display it on top of the default storage.
function recreateStorageLayout(storage, layer) {
    if (!stage) {
        setupStageCanvas(layer);
    }
    createShelves(storage, layer);
    createEntrances(storage, layer);
    createStorageBorder(layer);
    scaleBorders(layer);
    stage.add(layer);
}

// rescale whenever window dimensions and thus canvas container
// change.
function setupStageCanvas(layer) {
    const canvasContainer = document.querySelector('#mainContainer');
    stage = new Konva.Stage({
        container: 'mainContainer',
        width: canvasContainer.offsetWidth,
        height: canvasContainer.offsetHeight,
        x: -1, y: -1 // to counter border overlap
    });
    window.addEventListener('resize', () => {
        scaleStageToContainer(canvasContainer);
        scaleBorders(layer);
    });
    scaleStageToContainer(canvasContainer);
}

// sets zoom level to always display full storage
function getMinStageScale(container) {
    const tilemapWidth = tileSize * cols;
    const tilemapHeight = tileSize * rows;
    return Math.min(container.offsetWidth / tilemapWidth,
                    container.offsetHeight / tilemapHeight);
}

function scaleStageToContainer(container) {
    stage.scale({
        x: getMinStageScale(container),
        y: getMinStageScale(container)
    });
    stage.width(container.offsetWidth);
    stage.height(container.offsetHeight);
    stage.batchDraw();
}

// keep a consistent border width that should be similar to the canvas
// container border specified in the css
function scaleBorders(layer) {
    const scale = stage.scaleX();
    layer.find('Rect').each((rect) => rect.strokeWidth(1/scale));
    layer.find('Line').each((line) => line.strokeWidth(1/scale));
    layer.find('Arrow').each((arrow) => arrow.strokeWidth(1/scale));
}

// setup tiles, absolute access color for the time being till db access
// log is up and running
function createShelves(storage, layer) {
    storage.shelves.forEach(shelf => {
        const fillColor = storage === optimizedStorage ? Color.OPTIMIZED : Color.ACCESS;
        const heatmapColor = calculateHeatmapColor(storage.heatmapMaxAccessCounter, shelf, fillColor);
        let rect = new Konva.Rect({
            x: shelf.x * tileSize,
            y: shelf.y * tileSize,
            width: tileSize,
            height: tileSize,
            fill: heatmapColor,
            stroke: Color.BORDER,
            strokeWidth: 1
        });
        rect.on('mouseenter', (e) => {
            e.target.prevColor = e.target.fill();
            e.target.fill(Color.HIGHLIGHT);
            layer.batchDraw();
        });
        rect.on('mouseleave', (e) => {
            const col = e.target.prevColor;
            e.target.fill(col ? col : Color.DEFAULT);
            layer.batchDraw();
        });
        rect.on('click', (e) => {
            const x = Math.floor(e.target.x() / tileSize);
            const y = Math.floor(e.target.y() / tileSize);
            showShelfInventory(shelf, layer);
        });
        layer.add(rect);
    });
}

// sum all subshelf accesses of a given shelf, calc factor and shift
// default color towards provided fill color
function calculateHeatmapColor(maxAccess, shelf, fillColor) {
    if (maxAccess === 0) {
        return Color.DEFAULT;
    }
    const defCol = Konva.Util.getRGB(Color.DEFAULT);
    const accCol = Konva.Util.getRGB(fillColor);
    const redDiff = Math.abs(defCol.r - accCol.r);
    const greenDiff = Math.abs(defCol.g - accCol.g);
    const blueDiff = Math.abs(defCol.b - accCol.b);
    const shelfAccess = shelf.sub.reduce((res, sub) => res + sub.accessCounter, 0);
    const colShiftFactor = shelfAccess / maxAccess;
    const fillRed = defCol.r + (defCol.r > accCol.r ? -redDiff : redDiff) * colShiftFactor;
    const fillGreen = defCol.g + (defCol.g > accCol.g ? -greenDiff : greenDiff) * colShiftFactor;
    const fillBlue = defCol.b + (defCol.b > accCol.b ? -blueDiff : blueDiff) * colShiftFactor;
    return `rgb(${fillRed},${fillGreen},${fillBlue})`;
}

// gets called when user clicked on a shelf tile, which fires off a
// request to the server which sends back the articles the shelf
// holds. Show an popup overlay while deactivating all other event
// handling while it is being displayed and closed with a mouse click
// within the canvas dimensions.
function showShelfInventory(shelf) {
    if (!shelf || !shelf.sub) {
        console.log("Can't show shelf inventory, not valid.", shelf);
        return;
    }
    let modal = document.getElementById('invModal');
    let tableBody = document.getElementById('inventory');
    shelf.sub.forEach((sub) => {
        let row = document.createElement('tr');
        const items = [sub.article.name, sub.count, sub.accessCounter];
        items.forEach((item) => {
            let cell = document.createElement('td');
            const text = document.createTextNode(item);
            cell.appendChild(text);
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
    modal.style.display = 'block';
    window.onclick = (event) => {
        if (event.target == modal) {
            closeModalDialog();
        }
    };
}

function closeModalDialog() {
    let modal = document.getElementById('invModal');
    modal.style.display = 'none';
    window.onclick = null;
    let tableBody = document.getElementById('inventory');
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }
}

// fancy looking arrows instead of simple rectangles for entrance
// representation.
function createEntrances(storage, layer) {
    storage.entrances.forEach(ent => {
        let x, y, points;
        if (ent.x === 0 || ent.x === cols - 1) {
            x = ent.x * tileSize + (ent.x === 0 ? 0 : tileSize);
            y = ent.y * tileSize + tileSize / 2;
            points = [-tileSize*0.6, 0, tileSize*0.6, 0];
        }
        if (ent.y === 0 || ent.y === rows - 1) {
            x = ent.x * tileSize + tileSize / 2;
            y = ent.y * tileSize + (ent.y === 0 ? 0 : tileSize);
            points = [0, -tileSize*0.6, 0, tileSize*0.6];
        }
        let arrow = new Konva.Arrow({
            x: x,
            y: y,
            points: points,
            pointerLength: 5,
            pointerWidth: 5,
            pointerAtBeginning: true,
            fill: Color.BORDER,
            stroke: Color.BORDER,
            strokeWidth: 1
        });
        layer.add(arrow);
    });
}

// simply draw the edges of the storage, more visually pleasing
function createStorageBorder(layer) {
    let border = new Konva.Line({
        points: [0, 0, 0, rows*tileSize, cols*tileSize,
                 rows*tileSize, cols*tileSize, 0, 0, 0],
        stroke: Color.BORDER,
        strokeWidth: 1
    });
    layer.add(border);
}

// response from server that includes both the (red) access heatmap
// based on time range as well as the (green) optimized setup which is
// derived from the default one; initate the animated transition between the two.
function optimizationPreviewReceived(defStorage, optStorage) {
    if (!defStorage || !defStorage.width || !defStorage.height || !optStorage ||
        defStorage.width !== optStorage.width || defStorage.height != optStorage.height)
    {
        console.log("Requested previews are not valid:", defStorage, optStorage);
        return;
    }

    // remove old setup when requesting another time range via slider
    let firstRun = true;
    if (stage && defaultLayer && optimizedLayer) {
        defaultLayer.destroy();
        optimizedLayer.destroy();
        stage.batchDraw();
        firstRun = false;
    }

    defaultStorage = defStorage;
    cols = defaultStorage.width;
    rows = defaultStorage.height;
    defaultLayer = new Konva.Layer();
    recreateStorageLayout(defaultStorage, defaultLayer);

    optimizedStorage = optStorage;
    optimizedLayer = new Konva.Layer({ opacity: 0, visible: false });
    recreateStorageLayout(optimizedStorage, optimizedLayer);

    // keep slider disabled in case the db access log has no entries
    const timeRange = accessSlider.noUiSlider.get();
    if (new Date(timeRange[1]).valueOf() > new Date('1970-01-02').valueOf()) {
        accessSlider.removeAttribute('disabled');
    }

    if (firstRun) {
        document.getElementById('session-option').text =
            defaultStorage.name ? defaultStorage.name : defaultStorage._id;
        requestAvailableStorages();
        animatePreviewTransition();
    }
}

// response from server with min and max timestamps from db log; in
// case there is nothing to receive server-wise display the empty
// default without any kind of animation storage instead.
function sliderTimeRangeReceived(minTime, maxTime) {
    if (minTime >= 0 && maxTime <= Date.now() / 1000 && minTime !== maxTime) {
        accessSlider.noUiSlider.updateOptions({
            range: { min: minTime, max: maxTime },
            start: [minTime, maxTime]
        }, true);
        setTimeRangeLabels(minTime, maxTime);
        requestOptimizedStorageSetupPreview(minTime, maxTime);
    } else {
        requestTemplateStorageLayout();
    }
}

function requestTemplateStorageLayout() {
    sendMessage('reqlayout', { _id: null, observeStorage: false });
}

// when log db is empty and nothing can be optimized, show the empty
// template storage without transition animation instead.
function templateStorageReceived(storage) {
    if (!storage || !storage.width || !storage.height) {
        console.log("Requested storage layout is not valid:", storage);
        return;
    }
    defaultStorage = storage;
    cols = defaultStorage.width;
    rows = defaultStorage.height;
    document.getElementById('session-option').text = storage.name ? storage.name : storage._id;
    requestAvailableStorages();
    defaultLayer = new Konva.Layer();
    recreateStorageLayout(defaultStorage, defaultLayer);
}

// response from server when 'optimize' button was pressed, provided
// storageID matches new storage json file that containes the
// optimized setup.
function optimizedStorageIDReceived(storageID) {
    if (storageID > 0) {
        writeToSessionStorage('sessionID', storageID);
        window.location.href = 'view-storage.html';
    }
}

// populate the loading dropbox with loadable and valid storages on
// the server side; storages consists only of [{_id, name}, {_id,
// name}, ...], not the complete storage object.
function receivedAvailableStorages(storages) {
    if (!storages || storages.length < 1) {
        console.log("No valid storages available for loading:", storages);
        return;
    }
    let dropdown = document.getElementById('load-select')
    storages.forEach(str => {
        let option = document.createElement("option");
        option.value = str._id;
        option.text = str.name ? str.name : str._id;
        dropdown.appendChild(option);
    });
    dropdown.onchange = (event) => loadSelectedStorage(event.target.value);
    dropdown.disabled = false;
}

// utilize page reloading to clear running worker animations and
// resetting the server connection.
function loadSelectedStorage(id) {
    if (id === "session") {
        console.log("Not requesting the currently loaded storage layout again.");
        return;
    }
    writeToSessionStorage('sessionID', id);
    window.location.reload(true);
}

// we're using html5 storage to keep the sessionID between 'create'
// and 'view' html pages to later request the created and stored
// storage layout from the server.
function writeToSessionStorage(key, value) {
    let storage = window['sessionStorage'];
    if (!storage) {
        console.log('Session storage not available in your browser. Are your cookies disabled?');
        return;
    }
    if (!key || !value) {
        console.log("Can't store provided key value pair:", key, value);
        return;
    }
    storage.setItem(key, value);
}

// preliminary color flipping; once db access log supports storages
// this show actual color shifts based on access counter
function animatePreviewTransition() {
    const animDelayInMs = 3000;
    const shiftDurationInMs = 250;
    let showPreview = true;
    let f = () => {
        optimizedLayer.to({
            opacity: (showPreview ? 1 : 0),
            duration: shiftDurationInMs / 1000
        });
        if (showPreview) {
            optimizedLayer.visible(true);
        } else {
            setTimeout(() => optimizedLayer.visible(false), shiftDurationInMs);
        }
        showPreview = !showPreview;
        setTimeout(f, animDelayInMs);
    };
    setTimeout(f, animDelayInMs);
}

function connectToServer() {
    socket = new WebSocket('ws://localhost:8080');
    socket.onmessage = (msg) => {
        handleServerMessage(msg);
    };
    socket.onerror = (error) => {
        console.log('Socket error:', error);
    };
    return new Promise((resolve) => {
        socket.onopen = () => {
            console.log('Connected to server');
            resolve();
        };
    });
}

// if we can find a sessionID within the browser's html5 session
// storage, we use that. This way we can directly request the
// previously created and sent storage layout from
// create-storage.html.
function readFromSessionStorage(key) {
    let storage = window['sessionStorage'];
    if (!storage) {
        console.log('Session storage not available in your browser. Are your cookies disabled?');
        return;
    }
    if (!key) {
        console.log("Provided key not valid:", key);
        return;
    }
    return storage.getItem(key);
}

// only accepting server messages in the following object form:
// {
//     type: '...',
//     content: { ... }
// }
function handleServerMessage(msg) {
    let data, type, content;
    try {
        data = JSON.parse(msg.data);
        type = data.type;
        content = data.content;
    } catch (err) {
        console.log('Message parsing error: ' + err);
        console.log(msg);
        return;
    }
    if (type !== 'orderupdate') {
        console.log('Received:', type);
    }
    switch (type) {
    case 'id': break;
    case 'storage':
        templateStorageReceived(content);
        break;
    case 'shelfinventory': break;
    case 'orderupdate': break;
    case 'preview':
        optimizationPreviewReceived(content.regular, content.optimized);
        break;
    case 'range':
        sliderTimeRangeReceived(content.min, content.max);
        break;
    case 'applied':
        optimizedStorageIDReceived(content._id);
        break;
    case 'presentation':
        break;
    case 'available':
        receivedAvailableStorages(content);
        break;
    default:
        console.log('Unknown type provided in server message:', type);
    }
}

// ask server to calculate a preview of an optimized storage setup
// that can then be animated to see a clear comparison to the current
// based on log data from the db. Parameters from and to reference
// db's start and end unix timestamps in seconds. For now we request
// all access log entries, will change once we have working range
// sliders in place.
function requestOptimizedStorageSetupPreview(accessRangeFrom, accessRangeTo)
{
    sendMessage('reqpreview', {
        _id: sessionID,
        from: accessRangeFrom,
        to: accessRangeTo
    });
}

// ask server for min and max timestamps straight from the db access
// log to set the slider accordingly
function requestAccessSliderRange() {
    sendMessage('reqrange', { _id: sessionID });
}

function requestAvailableStorages() {
    sendMessage('available', { current: defaultStorage._id });
}

// ask the server to transform the regular storage into the optimized
// one described via access range slider
function requestSavingOptimization() {
    if (!defaultStorage || !optimizedStorage ||
        defaultStorage.heatmapMaxAccessCounter === 0 ||
        optimizedStorage.heatmapMaxAccessCounter === 0)
    {
        console.log('Received storage previews are not valid candidates');
        return;
    }
    if (!accessSlider.hasAttribute('disabled')) {
        const [minVal, maxVal] = getSliderMinMaxValues();
        sendMessage('applypreview', {
            _id: sessionID,
            from: minVal,
            to: maxVal
        });
    }
}

// stringify because that's what the websockets expect, other options
// would be sending array or binary blob data.
function sendMessage(type, data) {
    if (!socket || socket.readyState !== socket.OPEN) {
        console.log('Server connection not established, try refreshing the page');
        return;
    }
    try {
        socket.send(JSON.stringify({ type: type, content: data }));
        console.log('Sent:', type);
    } catch (err) {
        console.log('Could not send message to server:' + err);
    }
}
