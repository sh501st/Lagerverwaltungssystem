// TODO: should be fetched from the css for consistency reasons
const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    BORDER: '#606060',
    ACCESS: '#ee3060',
    OPTIMIZED: '#30ee60'
});

let storage, optimizedStorage, cols, rows;
let stage, defaultLayer, optimizedLayer;
let socket, sessionID;

const tileSize = 32;

function main() {
    sessionID = readFromSessionStorage('sessionID');
    connectToServer().then(() => {
	requestStorageLayoutFromServer(sessionID);
    });
}

// called by message handler as soon as the requested server response
// is available
function storageReceivedFromServer(recvStorage) {
    if (!recvStorage || !recvStorage.width || !recvStorage.height) {
	console.log("Requested storage layout is not valid:", recvStorage);
	return;
    }
    storage = recvStorage;
    cols = storage.width;
    rows = storage.height;
    defaultLayer = new Konva.Layer({ opacity: 1 });
    recreateStorageLayout(storage, defaultLayer);
    requestOptimizedStorageSetupPreview();
}

// initialize the canvas and setup all the graphical fluff; will also
// be called once we receive an optimized storage preview from the
// server to display it on top of the default storage.
function recreateStorageLayout(storage, layer) {
    if (!stage) {
	setupStageCanvas();
    }
    createShelves(storage, layer);
    createEntrances(storage, layer);
    stage.add(layer);
}

// rescale whenever window dimensions and thus canvas container
// change.
function setupStageCanvas() {
    const canvasContainer = document.querySelector('#mainContainer');
    stage = new Konva.Stage({
	container: 'mainContainer',
	width: canvasContainer.offsetWidth,
	height: canvasContainer.offsetHeight,
    });
    window.addEventListener('resize', () => scaleStageToContainer(canvasContainer));
    scaleStageToContainer(canvasContainer);
}

// sets zoom level to always display full storage
function getMinStageScale(container) {
    const tilemapWidth = tileSize * cols;
    const tilemapHeight = tileSize * rows;
    const widthDiff = container.offsetWidth - tilemapWidth;
    const heightDiff = container.offsetHeight - tilemapHeight;

    if (widthDiff < heightDiff) {
	return container.offsetWidth / tilemapWidth;
    } else {
	return container.offsetHeight / tilemapHeight;
    }
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

// setup tiles, absolute access color for the time being till db access
// log is up and running
function createShelves(storage, layer) {
    const fillColor = storage === optimizedStorage ? Color.OPTIMIZED : Color.ACCESS;
    storage.shelves.forEach(shelf => {
	let rect = new Konva.Rect({
	    x: shelf.x * tileSize,
	    y: shelf.y * tileSize,
	    width: tileSize,
	    height: tileSize,
	    fill: fillColor,
	    stroke: Color.BORDER,
	    strokeWidth: 2
	});
	layer.add(rect);
    });
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
	    strokeWidth: 2
	});
	layer.add(arrow);
    });
}

function optimizedPreviewReceived(storage) {
    optimizedStorage = storage;
    optimizedLayer = new Konva.Layer({ opacity: 0 });
    recreateStorageLayout(optimizedStorage, optimizedLayer);
    animatePreviewTransition();
}

// preliminary color flipping; once db access log supports storages
// this show actual color shifts based on access counter
function animatePreviewTransition() {
    const animDelay = 5000;
    let showPreview = true;
    let f = () => {
	optimizedLayer.to({
	    opacity: (showPreview ? 1 : 0),
	    duration: 1
	});
	showPreview = !showPreview;
	setTimeout(f, animDelay);
    };
    setTimeout(f, animDelay);
}

// TODO: close connection of tab refresh or close events socket events
// slightly different from the server's socket handling since this is
// provided by the web browser instead of the node wrapper for
// websockets. Promise for semi-blocking and waiting while connection
// is established in the background.
function connectToServer() {
    socket = new WebSocket('ws://localhost:8080');
    socket.onopen = () => {
	console.log('Connected to server');
    };
    socket.onmessage = (msg) => {
	handleServerMessage(msg);
    };
    return new Promise((resolve) => setTimeout(resolve, 1000));
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
    case 'id':
	break;
    case 'storage':
	storageReceivedFromServer(content);
	break;
    case 'shelfinventory':
	break;
    case 'orderupdate':
	break;
    case 'preview':
	optimizedPreviewReceived(content);
	break;
    default:
	console.log('Unknown type provided in server message:', type);
    }
}

function requestStorageLayoutFromServer(sessionID) {
    if (!socket || socket.readyState !== socket.OPEN) {
	console.log('Server connection not established, try refreshing the page');
	return;
    }
    sendMessage('reqlayout', { _id: sessionID, observeStorage: false });
}

// ask server to calculate a preview of an optimized storage setup
// that can then be animated to see a clear comparison to the current
// based on log data from the db. Parameters from and to reference
// db's start and end unix timestamps in seconds. For now we request
// all access log entries, will change once we have working range
// sliders in place.
function requestOptimizedStorageSetupPreview(
    accessRangeFrom = 0, accessRangeTo = Math.floor((new Date).getTime()/1000))
{
    if (!socket || socket.readyState !== socket.OPEN) {
	console.log('Server connection not established, try refreshing the page');
	return;
    }
    sendMessage('reqpreview', {
	_id: sessionID,
	from: accessRangeFrom,
	to: accessRangeTo
    });
}

// stringify because that's what the websockets expect, other options
// would be sending array or binary blob data.
function sendMessage(type, data) {
    console.log('Sent:', type);
    try {
	socket.send(JSON.stringify({ type: type, content: data }));
    } catch (err) {
	console.log('Could not send message to server:' + err);
    }
}
