const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    BORDER: '#606060',
    HIGHLIGHT: '#30aaee',
    ACCESS: '#ee3060',
    OVERLAY: '#909090'
});

let storage, cols, rows;
let stage, layer, greyOverlayLayer, popupLayer;

const width = window.innerWidth;
const height = window.innerHeight;
const size = 32;

async function main() {
    storage = await importLayoutFromJSON();
    cols = storage.width;
    rows = storage.height;

    stage = new Konva.Stage({
	container: 'mainContainer',
	x: (window.innerWidth - cols * size) / 2,
	y: (window.innerHeight - rows * size) / 2,
	width: width,
	height: height,
	draggable: true
    });
    window.addEventListener('wheel', handleMouseScroll);

    layer = new Konva.Layer();
    createStorageBorder();
    createShelves();
    createEntrances();
    stage.add(layer);

    greyOverlayLayer = new Konva.Layer();
    let block = new Konva.Rect({
	x: 0,
	y: 0,
	width: cols * size,
	height: rows * size,
	fill: Color.OVERLAY,
	opacity: 0.7
    });
    greyOverlayLayer.add(block);
    greyOverlayLayer.hide();
    stage.add(greyOverlayLayer);

    popupLayer = new Konva.Layer();
    let popup = new Konva.Rect({
	id: 'popup',
	x: cols * size / 4,
	y: rows * size / 8,
	width: cols * size / 2,
	height: rows * size * 0.75,
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
}

function handleMouseScroll(e) {
    e.preventDefault();
    const fact = 1.1;
    const origScale = stage.scaleX();
    const newScale = e.deltaY < 0 ? origScale * fact : origScale / fact;
    const mx = stage.getPointerPosition().x;
    const my = stage.getPointerPosition().y;
    const nx = (mx - stage.x()) / origScale;
    const ny = (my - stage.y()) / origScale;
    stage.scale({ x: newScale, y: newScale });
    stage.position({
	x: mx - nx * newScale,
	y: my - ny * newScale
    });
    stage.batchDraw();
}

function createStorageBorder() {
    let border = new Konva.Line({
	points: [0, 0, 0, rows*size, cols*size, rows*size, cols*size, 0, 0, 0],
	stroke: Color.BORDER,
	strokeWidth: 2
    });
    layer.add(border);
}

function createShelves() {
    storage.shelves.forEach(shelf => {
	let rect = new Konva.Rect({
	    x: shelf.x * size,
	    y: shelf.y * size,
	    width: size,
	    height: size,
	    fill: Color.DEFAULT,
	    stroke: Color.BORDER,
	    strokeWidth: 2
	});
	rect.on('mouseenter', (e) => {
	    e.target.fill(Color.HIGHLIGHT);
	    layer.batchDraw();
	});
	rect.on('mouseleave', (e) => {
	    e.target.fill(Color.DEFAULT);
	    layer.batchDraw();
	});
	rect.on('click', (e) => {
	    const x = Math.floor(e.target.x() / size);
	    const y = Math.floor(e.target.y() / size);
	    let shelf = storage.shelves.find((elem) => {
		return elem.x === x && elem.y == y;
	    });
	    if (shelf) {
		showShelfInventory(shelf);
	    }
	});
	layer.add(rect);
    });
}

function showShelfInventory(shelf) {
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

function createEntrances() {
    storage.entrances.forEach(ent => {
	let x, y, points;
	if (ent.x === 0 || ent.x === cols - 1) {
	    x = ent.x * size + (ent.x === 0 ? -size : size);
	    y = ent.y * size + size / 2;
	    points = [-size*0.75, 0, size*0.75, 0];
	}
	if (ent.y === 0 || ent.y === rows - 1) {
	    x = ent.x * size + size / 2;
	    y = ent.y * size + (ent.y === 0 ? -size : size);
	    points = [0, -size*0.75, 0, size*0.75];
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

async function importLayoutFromJSON() {
    return fetch('storage-layout-template.json').then(res => res.json())
}
