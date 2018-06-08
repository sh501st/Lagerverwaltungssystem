// TODO: should be fetched from the css for consistency reasons
const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    BORDER: '#606060',
    HIGHLIGHT: '#30aaee',
    ACCESS: '#ee3060',
    OVERLAY: '#909090'
});

let storage, cols, rows;
let stage, layer, greyOverlayLayer, popupLayer, statusLayer;
let socket, sessionID;
let heatmapMaxAccessCounter;

// keep at integer values, otherwise we have to audit the code for
// possible floating rounding errors
const tileSize = 32;

function main() {
    sessionID = readFromSessionStorage('sessionID');
    connectToServer().then(() => {
	requestStorageLayoutFromServer(sessionID);
    });
}

// called by message handler as soon as the requested server response
// is available
function storageReceivedFromServer() {
    if (!storage || !storage.width || !storage.height) {
	console.log("Requested storage layout is not valid:", storage);
	return;
    }
    cols = storage.width;
    rows = storage.height;
    heatmapMaxAccessCounter = 0;
    recreateStorageLayout();
}

// initialize the canvas and setup all the graphical fluff (tiles,
// borders, layers, popup, etc)
function recreateStorageLayout() {
    setupStageCanvas();

    layer = new Konva.Layer();
    createStorageBorder();
    createShelves();
    createEntrances();
    stage.add(layer);

    greyOverlayLayer = new Konva.Layer();
    let block = new Konva.Rect({
	x: 0,
	y: 0,
	width: cols * tileSize,
	height: rows * tileSize,
	fill: Color.OVERLAY,
	opacity: 0.7
    });
    greyOverlayLayer.add(block);
    greyOverlayLayer.hide();
    stage.add(greyOverlayLayer);

    // TODO: should really be html+css instead of this ugly overlay
    popupLayer = new Konva.Layer();
    let popup = new Konva.Rect({
	id: 'popup',
	x: cols * tileSize / 4,
	y: rows * tileSize / 8,
	width: cols * tileSize / 2,
	height: rows * tileSize * 0.75,
	fill: Color.DEFAULT,
	stroke: Color.BORDER,
	strokeWidth: 3
    });
    const textPadding = 20;
    let inventoryText = new Konva.Text({
	id: 'invLabel',
	x: popup.x() + textPadding,
	y: popup.y() + textPadding,
	width: popup.width() - textPadding * 2,
	height: popup.height() - textPadding * 2,
	fontSize: 24,
	fill: Color.BORDER,
	text: 'EMPTY'
    });
    popupLayer.add(popup);
    popupLayer.add(inventoryText);
    popupLayer.hide();
    stage.add(popupLayer);

    // TODO: should really be html+css instead of this ugly overlay.
    statusLayer = new Konva.Layer();
    let orderText = new Konva.Text({
	id: 'ordLabel',
	x: cols * tileSize + 30,
	y: 0,
	fontSize: 16,
	fill: Color.BORDER,
	text: 'No orders yet.'
    });
    statusLayer.add(orderText);
    stage.add(statusLayer);
}

// rescale whenever window dimensions and thus canvas container
// change. Allow dragging and also zooming the canvas with mouse wheel
// scroll.
function setupStageCanvas() {
    const canvasContainer = document.querySelector('#mainContainer');
    stage = new Konva.Stage({
	container: 'mainContainer',
	width: canvasContainer.offsetWidth,
	height: canvasContainer.offsetHeight,
	draggable: true
    });
    window.addEventListener('wheel', (evt) => {
	evt.preventDefault(); // disable browser handling the scroll
	handleMouseScroll(canvasContainer, evt.deltaY);
    });
    window.addEventListener('resize', (evt) => {
	scaleStageToContainer(canvasContainer);
    });
    scaleStageToContainer(canvasContainer);
}

function scaleStageToContainer(container) {
    const fitScale = getMinStageScale(container);
    stage.scale({ x: fitScale, y: fitScale });
    stage.width(container.offsetWidth);
    stage.height(container.offsetHeight);
    stage.batchDraw();
}

// disallow zooming out beyond storage bounds
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

// limit zooming in to a reasonable default
function getMaxStageScale(container) {
    const maxFactor = 3;
    return getMinStageScale(container) * maxFactor;
}

// restrict val to specified min and max bounds
function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
}

// zoom in at and out of mouse position instead of left upper corner
// (default behaviour)
function handleMouseScroll(container, scrollDelta) {
    const fact = 1.1;
    const maxScale = getMaxStageScale(container);
    const minScale = getMinStageScale(container);
    const prevScale = stage.scaleX();
    const newScale = clamp(prevScale * (scrollDelta < 0 ? fact : 1/fact),
			   minScale, maxScale);
    const mx = stage.getPointerPosition().x;
    const my = stage.getPointerPosition().y;
    const nx = (mx - stage.x()) / prevScale;
    const ny = (my - stage.y()) / prevScale;
    stage.scale({ x: newScale, y: newScale });
    stage.position({
	x: mx - nx * newScale,
	y: my - ny * newScale
    });
    stage.batchDraw();
}

// simply draw the edges of the storage, more visually pleasing
function createStorageBorder() {
    let border = new Konva.Line({
	points: [0, 0, 0, rows*tileSize, cols*tileSize,
		 rows*tileSize, cols*tileSize, 0, 0, 0],
	stroke: Color.BORDER,
	strokeWidth: 2
    });
    layer.add(border);
}

// setup tiles and mouse hooks for hover highlight and popup inventory
// clicking
function createShelves() {
    storage.shelves.forEach(shelf => {
	let rect = new Konva.Rect({
	    x: shelf.x * tileSize,
	    y: shelf.y * tileSize,
	    width: tileSize,
	    height: tileSize,
	    fill: Color.DEFAULT,
	    stroke: Color.BORDER,
	    strokeWidth: 2
	});
	rect.accessCounter = 0;
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
	    sendMessage('shelfinventory', { _id: storage._id, x: x, y: y });
	});
	layer.add(rect);
    });
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
    layer.listening(false);
    stage.draggable(false);
    window.removeEventListener('wheel', handleMouseScroll);

    let invLabel = popupLayer.find('#invLabel');
    let txt = 'Shelf:\n\n';
    shelf.sub.forEach((obj) => {
	txt += '  ' + obj.article.name + ': ' + obj.count + '\n';
    });
    invLabel.text(txt);

    greyOverlayLayer.show();
    popupLayer.show();
    stage.draw();

    stage.on('click', () => {
	window.addEventListener('wheel', handleMouseScroll);
	stage.draggable(true);
	layer.listening(true);
	popupLayer.hide();
	greyOverlayLayer.hide();
	stage.draw();
	stage.off('click');
    });
}

// fancy looking arrows instead of simple rectangles for entrance
// representation.
function createEntrances() {
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

// update the list beside the storage area whenever new updates from
// the server come in. TODO: should really be html+css instead of this
// inelegant horror show.
function updateOrderQueueLabel(orders) {
    let label = statusLayer.find('#ordLabel');
    let txt = 'Order queue:\n\n';
    orders.forEach((ord) => {
	txt += 'Order ' + ord.id + ':\n';
	ord.articles.forEach((art) => {
	    txt += '    - ' + art.name + '\n';
	});
	txt += '\n';
    });
    label.text(txt);
    statusLayer.batchDraw();
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
    case 'id': // ignore for now, accept only in 'create-storage'
	break;
    case 'storage':
	storage = content;
	storageReceivedFromServer();
	break;
    case 'shelfinventory':
	showShelfInventory(content);
	break;
    case 'orderupdate':
	updateOrderQueueLabel(content.orders);
	if (content.currentOrder) {
	    spawnWorker(content.currentOrder);
	}
	break;
    default:
	console.log('Unknown type provided in server message:', type);
    }
}

// since we now support the heatmap, avoid flashing shelves and
// instead of an actual article representation being moved from the
// shelf towards the worker, simulating an item retrieval.
function visualizeArticleRetrieval(fromX, fromY, toX, toY) {
    const boxSize = tileSize / 2;
    let itemBox = new Konva.Rect({
	x: fromX * tileSize + boxSize / 2,
	y: fromY * tileSize + boxSize / 2,
	width: boxSize,
	height: boxSize,
	fill: Color.HIGHLIGHT,
	opacity: 0
    });
    layer.add(itemBox);

    const timeStepInMs = 500;
    itemBox.to({ // fade in
	duration: timeStepInMs / 1000,
	opacity: 1
    });
    setTimeout(() => itemBox.to({ // move
	duration: timeStepInMs / 1000,
	x: toX * tileSize + boxSize / 2,
	y: toY * tileSize + boxSize / 2
    }), timeStepInMs);
    setTimeout(() => itemBox.destroy(), timeStepInMs * 2);
}

// for now heatmap get's updated on each shelf access, could be
// switched to timebased approach, e.g. once every two seconds, if
// performance suffers on fifty+ workers accessing multiple times per
// second concurrently. Slowly shifting fill from default to specified
// access color, where highest access counter per shelf influences the
// shift factor.
function updateHeatmap(shelfX, shelfY) {
    const defCol = Konva.Util.getRGB(Color.DEFAULT);
    const accCol = Konva.Util.getRGB(Color.ACCESS);
    const redDiff = Math.abs(defCol.r - accCol.r);
    const greenDiff = Math.abs(defCol.g - accCol.g);
    const blueDiff = Math.abs(defCol.b - accCol.b);
    layer.find('Rect').each((rect) => {
	if (rect.fill() === Color.HIGHLIGHT) {
	    return; // item box instead of shelf
	}
	if (rect.x() === shelfX * tileSize && rect.y() === shelfY * tileSize) {
	    rect.accessCounter++;
	    if (rect.accessCounter > heatmapMaxAccessCounter) {
		heatmapMaxAccessCounter++;
	    }
	}
	if (heatmapMaxAccessCounter !== 0) {
	    const colShiftFactor = rect.accessCounter / heatmapMaxAccessCounter;
	    const fillRed = defCol.r +
		  (defCol.r > accCol.r ? -redDiff : redDiff) * colShiftFactor;
	    const fillGreen = defCol.g +
		  (defCol.g > accCol.g ? -greenDiff : greenDiff) * colShiftFactor;
	    const fillBlue = defCol.b +
		  (defCol.b > accCol.b ? -blueDiff : blueDiff) * colShiftFactor;
	    rect.fill(`rgb(${fillRed},${fillGreen},${fillBlue})`);
	}
    });
}

// spawns a imaginary worker and moves him along a server generated
// path. expected path form with subpaths: [[x1, y1, ..., xn, xy],
// [...]] speed is the rate at which the worker moves per second, e.g.
// 4 tiles per sec.
function spawnWorker(order) {
    let path = order.path;
    let speed = order.speed;
    let worker = new Konva.Circle({
	x: path[0].shift() * tileSize,
	y: path[0].shift() * tileSize,
	radius: tileSize / 2,
	offsetX: -tileSize / 2,
	offsetY: -tileSize / 2,
	fill: Color.HIGHLIGHT
    });
    layer.add(worker);

    let moveAnimations = [];
    path.forEach((subpath) => {
	let moving = new Konva.Animation((frame) => {
	    if (subpath.length < 2) {
		// end of subpath reached, either finish up subpath
		// animations and delete workers since we're done, or
		// animate item retrieval from associated shelf nearby
		// when it's only a temp stop.
		if (moveAnimations.length === 0) {
		    worker.destroy();
		} else if (moveAnimations.length === 1) {
		    moveAnimations.shift().start();
		} else {
		    const wx = worker.x() / tileSize;
		    const wy = worker.y() / tileSize;
		    const article = order.articles.find((article) => {
			const ax = article.shelfX;
			const ay = article.shelfY;
			return (wx == ax && (wy == ay+1 || wy == ay-1))
			    || ((wx == ax+1 || wx == ax-1) && wy == ay);
		    });
		    if (article) {
			visualizeArticleRetrieval(article.shelfX, article.shelfY, wx, wy);
			updateHeatmap(article.shelfX, article.shelfY);
		    }
		    setTimeout(() => moveAnimations.shift().start(), 1000);
		}
		moving.stop();
		// TODO: is konva.animation being cleaned up here or still lingering around?
		delete moving;
	    } else {
		// fps based movements, move worker towards target in
		// delta steps, if distance is smaller than the delta
		// frame movement required, teleport right on target
		// to avoid jitter.
		const tx = subpath[0] * tileSize;
		const ty = subpath[1] * tileSize;
		const ddist = speed * tileSize * frame.timeDiff / 1000;
		if (Math.abs(worker.x() - tx) <= ddist) {
		    worker.x(tx);
		} else {
		    worker.x(worker.x() > tx ? worker.x() - ddist : worker.x() + ddist);
		}
		if (Math.abs(worker.y() - ty) <= ddist) {
		    worker.y(ty);
		} else {
		    worker.y(worker.y() > ty ? worker.y() - ddist : worker.y() + ddist);
		}
		// once target is reached, get the next target coords
		if (worker.x() === tx && worker.y() === ty) {
		    subpath.shift();
		    subpath.shift();
		}
	    }
	}, layer);
	moveAnimations.push(moving);
    });
    moveAnimations.shift().start();
}

function requestStorageLayoutFromServer(sessionID) {
    if (!socket || socket.readyState !== socket.OPEN) {
	console.log('Server connection not established, try refreshing the page');
	return;
    }
    sendMessage('reqlayout', { _id: sessionID, observeStorage: true });
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
