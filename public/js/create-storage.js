// necessary work konva drag and drop behaviour
const Mode = Object.freeze({
    NONE: Symbol("none"),
    ADD: Symbol("add"),
    REM: Symbol("rem")
});

// TODO: fetch colors from css
const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    SHELF: '#30aaee',
    ENTRANCE: '#30ee8d',
    UNREACHABLE: '#ee3060',
    INVALIDENTRANCE: '#303030',
    BORDER: '#606060'
});

// keep at integer values, otherwise we have to audit the code for
// possible floating rounding errors
const tileSize = 32;
const numSubShelves = 4;

let mode = Mode.NONE;
let stage, layer;
let socket, sessionID;

// values can be changed via html sliders
let cols;
let rows;
let workerCount;

function main() {
    initUiElements();
    setupStageCanvas();
    clearSessionStorage();
    connectToServer();
}

function initUiElements() {
    cols = document.getElementById('widthslider').value;
    rows = document.getElementById('heightslider').value;
    workerCount = document.getElementById('workerslider').value;
    document.getElementById('widthlabel').innerHTML = 'Width: ' + cols;
    document.getElementById('heightlabel').innerHTML = 'Height: ' + rows;
    document.getElementById('workerlabel').innerHTML = 'Workers: ' + workerCount;
}

// initial the canvas and mouse interactable tiles. Canvas scales to
// container width and height upon 'resize' window event.
function setupStageCanvas() {
    const canvasContainer = document.querySelector('#mainContainer');
    stage = new Konva.Stage({
    container: 'mainContainer',
    width: canvasContainer.offsetWidth,
    height: canvasContainer.offsetHeight,
    x: -1, y: -1 // to counter border overlap
    });
    window.addEventListener('resize', () => {
    scaleStageToContainer(canvasContainer);
    scaleBorders(canvasContainer, layer);
    });

    layer = new Konva.Layer();
    // visibility workaround since konva has a problem creating and
    // destroying a whole amout of nodes without buggying out. Now we
    // simply hide the nodes and reshowing them later on without
    // changing the actual tile setup
    const maxVisCol = document.getElementById('widthslider').max;
    const maxVisRow = document.getElementById('heightslider').max;
    for (let row = 0; row < maxVisRow; row++) {
    for (let col = 0; col < maxVisCol; col++) {
        const visible = col < cols && row < rows;
        createTile(col, row, visible);
    }
    }

    scaleStageToContainer(canvasContainer);
    scaleBorders(canvasContainer, layer);
    stage.add(layer);
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
function scaleBorders(container, layer) {
    const minScale = getMinStageScale(container);
    layer.find('Rect').each((rect) => rect.strokeWidth(1/minScale));
}

// currently we are only clearing the session storage, which holds the
// sessionID for choosing the requesting the right json file from the
// server upon loading the view-storage.html, here. Thus, reloading
// the create-store.html will reload the same file over and over
// again. Might change later through the dev cycle.
function clearSessionStorage() {
    let storage = window['sessionStorage'];
    if (!storage) {
    console.log('Session storage not available in your browser. Are your cookies disabled?');
    return;
    }
    storage.clear();
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

function connectToServer() {
    socket = new WebSocket('ws://localhost:8080');
    socket.onopen = () => {
    console.log('Connected to server');
    };
    socket.onmessage = (msg) => {
    handleServerMessage(msg);
    };
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

    switch (type) {
    case 'id':
    sessionID = content._id;
    break;
    case 'presentation':
    break;
    default:
    console.log('Unknown type provided in server message:', type);
    }
}

// called on input slider change, grow or shrink stage width
function changeStorageWidth(width) {
    cols = width;
    document.getElementById('widthlabel').innerHTML = 'Width: ' + width;
    updateTileVisibility();
    scaleStageToContainer(document.querySelector('#mainContainer'));
}

// called on input slider change, grow or shrink stage height
function changeStorageHeight(height) {
    rows = height;
    document.getElementById('heightlabel').innerHTML = 'Height: ' + height;
    updateTileVisibility();
    scaleStageToContainer(document.querySelector('#mainContainer'));
}

// hide tiles which are not withing the size bounds specified by the
// width and height sliders in the sidebar, also removing entrances
// which are no longer edge tiles upon rescaling
function updateTileVisibility() {
    layer.find('Rect').each((tile) => {
    const tileX = Math.floor(tile.x() / tileSize);
    const tileY = Math.floor(tile.y() / tileSize);
    const visible = tileX < cols && tileY < rows;
    const isEntrance = tile.fill() === Color.ENTRANCE ||
          tile.fill() === Color.INVALIDENTRANCE;
    const isEdgeTile = tileX === 0 || tileX === cols-1 ||
          tileY === 0 || tileY === rows-1;
    if (!visible || (isEntrance && !isEdgeTile)) {
        tile.fill(Color.DEFAULT);
    }
    tile.visible(visible);
    });
    layer.batchDraw();
}

// called on input slider change, no functionality as of now
function changeStorageWorkers(workerCount) {
    this.workerCount = workerCount;
    document.getElementById('workerlabel').innerHTML = 'Workers: ' + workerCount;
}

// create the visible and clickable rectangles on the html canvas and
// hook up the necessary mouse actions.
function createTile(col, row, visible) {
    let quad = new Konva.Rect({
    x: col * tileSize,
    y: row * tileSize,
    width: tileSize,
    height: tileSize,
    fill: Color.DEFAULT,
    stroke: Color.BORDER,
    visible: visible,
    strokeWidth: 1,
    });
    // workaround since konva has no mouseDownMove (w/o drag) event
    quad.on('mouseenter', (e) => {
    if (mode === Mode.NONE) {
        return;
    }
    let obj = e.target;
    if (mode === Mode.ADD) {
        obj.fill(Color.SHELF);
        layer.batchDraw();
    } else if (mode === Mode.REM) {
        obj.fill(Color.DEFAULT);
        layer.batchDraw();
    }
    });
    quad.on('mousedown', (e) => {
    let obj = e.target;
    let btn = e.evt.button;
    if (btn === 0) { /* left mb */
        mode = Mode.ADD;
        obj.fill(Color.SHELF);
        layer.batchDraw();
    } else if (btn === 2) { /* right mb */
        mode = Mode.REM;
        obj.fill(Color.DEFAULT);
        layer.batchDraw()
    } else {
        mode = Mode.NONE;
    }
    });
    quad.on('mouseup', (e) => {
    mode = Mode.NONE;
    if (e.evt.button === 1) { /* middle mb */
        let obj = e.target;
        const col = Math.floor(obj.x() / tileSize);
        const row = Math.floor(obj.y() / tileSize);
        // if edge tile, add entrance
        if (col === 0 || col === cols - 1 ||
        row === 0 || row === rows - 1)
        {
        obj.fill(Color.ENTRANCE);
        layer.batchDraw();
        }
    }
    });
    layer.add(quad);
}

// check whether all placed (blue) tiles are reachable from some
// neighboring tile (up, down, left, right) before sending the json
// file to the server. This way we avoid generating shelfs and
// articles that are not reachable by any worker but are still being
// requested by via order.
function areAllShelvesReachable() {
    let grid = [];
    for (let col = 0; col < cols; col++) {
    grid[col] = [];
    }

    let placed = 0;
    let unreachableShelves = 0;
    let unreachableEntrances = 0;
    let nodes = [];
    layer.find('Rect').each((r) => {
    if (!r.visible()) { return; }
    const col = Math.floor(r.x() / tileSize);
    const row = Math.floor(r.y() / tileSize);
    grid[col][row] = r;
    r.visited = false;

    if (r.fill() === Color.SHELF || r.fill() === Color.UNREACHABLE) {
        r.fill(Color.UNREACHABLE);
        placed++;
        unreachableShelves++;
    } else if (r.fill() === Color.ENTRANCE ||
           r.fill() === Color.INVALIDENTRANCE) {
        if (nodes.length === 0) {
        nodes.push([col, row]);
        } else {
        r.fill(Color.INVALIDENTRANCE);
        unreachableEntrances++;
        }
    }
    });

    while (nodes.length > 0) {
    const node = nodes.pop();
    const col = node[0];
    const row = node[1];
    let rect = grid[col][row];
    rect.visited = true;

    let visitTile = (c, r) => {
        const alt = grid[c][r];
        if (!alt.visited && alt.fill() === Color.DEFAULT) {
        nodes.push([c, r]);
        } else if (!alt.visited && alt.fill() === Color.UNREACHABLE) {
        alt.visited = true;
        alt.fill(Color.SHELF);
        unreachableShelves--;
        } else if (!alt.visited && alt.fill() === Color.INVALIDENTRANCE) {
        alt.fill(Color.ENTRANCE);
        nodes.push([c, r]);
        unreachableEntrances--;
        }
    };

    if (col > 0) { visitTile(col-1, row); } // left
    if (col < cols - 1) { visitTile(col+1, row) } // right
    if (row > 0) { visitTile(col, row-1); } // up
    if (row < rows - 1) { visitTile(col, row+1); } // down
    }

    layer.batchDraw();
    return placed > 0 && unreachableShelves === 0 && unreachableEntrances === 0;
}

// send the placed tiles and entrances to the server, where the shelfs
// will be randomly filled with articles. We are setting the storage
// id to the current session id received by the server upon connecting
// which will not just be used to logically link the
// create-storage.html and view-storage.html together but will also be
// used as a filename on the server-side.
function sendJSONToServer() {
    if (!areAllShelvesReachable()) {
    console.log('Not all shelves are reachable or not all entrances ' +
            'are connected with each other, not sending');
    return;
    }
    let data = {
    _id: sessionID,
    width: cols,
    height: rows,
    shelves: [],
    entrances: []
    };
    layer.find('Rect').each((r) => {
    const col = Math.floor(r.x() / tileSize);
    const row = Math.floor(r.y() / tileSize);
    if (r.fill() === Color.SHELF) {
        data.shelves.push({ x: col, y: row, sub: [] });
    } else if (r.fill() === Color.ENTRANCE) {
        data.entrances.push({ x: col, y: row });
    }
    });

    if (socket && socket.readyState === socket.OPEN && data._id > 0) {
    sendMessage('newstorage', data);
    writeToSessionStorage('sessionID', sessionID);
    window.location.href = "view-storage.html";
    } else {
    console.log("Connection to server isn't ready");
    }
}

// websocket protocol requires sending arrays, binary blobs or
// strings, thus we are converting our objects to strings before
// sending them off.
function sendMessage(type, data) {
    console.log('Sent:', type);
    try {
    socket.send(JSON.stringify({
        type: type,
        content: data
    }));
    } catch (err) {
    console.log('Could not send message to server: ' + err);
    }
}
