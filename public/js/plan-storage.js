// TODO: should be fetched from the css for consistency reasons
const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    BORDER: '#606060',
    ACCESS: '#ee3060',
    OPTIMIZED: '#3b8c1d',
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
	requestOptimizedStorageSetupPreview(0, Math.floor((new Date).getTime() / 1000));
    });
}

// slider range is updated to unix timestamp min and max values once
// the server connection is established
function setupAccessSlider() {
    accessSlider = document.getElementById('accessSlider');
    noUiSlider.create(accessSlider, {
	start: [0, 100],
	connect: true,
	orientation: 'horizontal',
	tooltips: [true, true],
	step: 1,
	padding: 1,
	range: { 'min': 0, 'max': 100 },
	format: {
	    to: (val) => new Date(val * 1000).toISOString(),
	    from: (val) => val
	}
    });
    accessSlider.setAttribute('disabled', true);
    accessSlider.noUiSlider.on('change', () => {
	accessSlider.setAttribute('disabled', true);
	const vals = accessSlider.noUiSlider.get();
	const minTime = Date.parse(vals[0]) / 1000;
	const maxTime = Date.parse(vals[1]) / 1000;
	requestOptimizedStorageSetupPreview(minTime, maxTime);
    });
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
	    fill: calculateHeatmapColor(
		storage.heatmapMaxAccessCounter, shelf, fillColor),
	    stroke: Color.BORDER,
	    strokeWidth: 2
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
    optimizedLayer = new Konva.Layer({ opacity: 0 });
    recreateStorageLayout(optimizedStorage, optimizedLayer);

    accessSlider.removeAttribute('disabled');

    if (firstRun) {
	animatePreviewTransition();
    }
}

// response from server with min and max timestamps from db log
function sliderTimeRangeReceived(minTime, maxTime) {
    if (minTime >= 0 && maxTime <= Date.now() / 1000) {
	accessSlider.noUiSlider.updateOptions({
	    range: { min: minTime, max: maxTime },
	    start: [minTime, maxTime]
	}, true);
	accessSlider.removeAttribute('disabled');
    }
}

// preliminary color flipping; once db access log supports storages
// this show actual color shifts based on access counter
function animatePreviewTransition() {
    const animDelay = 3000;
    let showPreview = true;
    let f = () => {
	optimizedLayer.to({
	    opacity: (showPreview ? 1 : 0),
	    duration: 0.5
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
    case 'id': break;
    case 'storage': break;
    case 'shelfinventory': break;
    case 'orderupdate': break;
    case 'preview':
	optimizationPreviewReceived(content.regular, content.optimized);
	break;
    case 'range':
	sliderTimeRangeReceived(content.min, content.max);
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

function requestAccessSliderRange() {
    if (!socket || socket.readyState !== socket.OPEN) {
	console.log('Server connection not established, try refreshing the page');
	return;
    }
    sendMessage('reqrange', { _id: sessionID });
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
