const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    BORDER: '#606060'
});

let storage, stage, layer;
let cols, rows;

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
    addZoomListener();

    layer = new Konva.Layer();
    createStorageBorder();
    createShelves();
    createEntrances();
    stage.add(layer);
}

function addZoomListener() {
    window.addEventListener('wheel', (e) => {
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
    });
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
	layer.add(rect);
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
