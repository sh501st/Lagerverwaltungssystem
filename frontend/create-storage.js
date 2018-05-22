const Mode = Object.freeze({
    NONE: Symbol("none"),
    ADD: Symbol("add"),
    REM: Symbol("rem")
});

const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    SHELF: '#30aaee',
    ENTRANCE: '#30ee8d',
    UNREACHABLE: '#ee3060',
    BORDER: '#606060'
});

const width = 640;
const height = 480;
const size = 32;
const numSubShelves = 4;

const cols = Math.floor(width / size);
const rows = Math.floor(height / size);
let mode = Mode.NONE;
let stage, layer;

function main() {
    stage = new Konva.Stage({
	container: 'mainContainer',
	width: width,
	height: height
    });
    layer = new Konva.Layer();

    for (let row = 0; row < rows; row++) {
	for (let col = 0; col < cols; col++) {
	    createTile(col, row);
	}
    }
    stage.add(layer);
    document.getElementById('export').addEventListener('click', () => { exportJSON(); });
}

function createTile(col, row) {
    let quad = new Konva.Rect({
	x: col * size,
	y: row * size,
	width: size,
	height: size,
	fill: Color.DEFAULT,
	stroke: Color.BORDER,
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
	let btn = e.evt.button;
	if (btn === 0) { /* left mb */
	    mode = Mode.ADD;
	} else if (btn === 2) { /* right mb */
	    mode = Mode.REM;
	} else {
	    mode = Mode.NONE;
	}
    });
    quad.on('mouseup', (e) => {
	mode = Mode.NONE;
	if (e.evt.button === 1) { /* middle mb */
	    let obj = e.target;
	    const col = Math.floor(obj.x() / size);
	    const row = Math.floor(obj.y() / size);
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

function checkReachability() {
    const startTime = new Date().getTime();

    let grid = [];
    for (let col = 0; col < cols; col++) {
	grid[col] = [];
    }

    let placed = 0;
    let found = 0;
    let nodes = [];
    layer.find('Rect').each((r) => {
	const col = Math.floor(r.x() / size);
	const row = Math.floor(r.y() / size);
	grid[col][row] = r;
	r.visited = false;

	if (r.fill() === Color.SHELF || r.fill() === Color.UNREACHABLE) {
	    r.fill(Color.UNREACHABLE);
	    placed++;
	} else if (r.fill() === Color.ENTRANCE) {
	    nodes.push([col, row]);
	}
    });

    while (nodes.length > 0 && found < placed) {
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
		found++;
	    }
	};

	if (col > 0) { visitTile(col-1, row); } // left
	if (col < cols - 1) { visitTile(col+1, row) } // right
	if (row > 0) { visitTile(col, row-1); } // up
	if (row < rows - 1) { visitTile(col, row+1); } // down
    }

    layer.batchDraw();
    const timeDiff = new Date().getTime() - startTime;
    if (placed < 3) {
	console.log("Too few shelves placed.");
	return false;
    } else if (found < placed) {
	console.log("Shelves not reachable: " + (placed - found) + " (" + timeDiff + " ms)");
	return false;
    } else {
	console.log("All shelves reachable. (" + timeDiff + " ms)");
	return true;
    }
}

let articles = [];
function readInMockArticles() {
    return fetch('articles.csv').then(response => response.text()).then(text => {
	text.split('\n').map(line => {
	    const art = line.split(',');
	    const obj = { id: art[0], name: art[1], desc: art[2], prod: art[3] };
	    if (obj.id !== '#id') {
		articles.push(obj);
	    }
	});
    });
}

function randInt(from, to) /* inclusive */ {
    return Math.floor(Math.random() * (to - from + 1) + from);
}

function generateRandomSubShelf() {
    return {
	article: articles[randInt(0, articles.length -1)],
	count: randInt(1, 100)
    };
}

async function exportJSON() {
    // TODO: transform to what backend expects and send valid json.
    if (checkReachability()) {
	await readInMockArticles();
	let data = {
	    width: cols,
	    height: rows,
	    shelves: [],
	    entrances: []
	};
	layer.find('Rect').each((r) => {
	    const col = Math.floor(r.x() / size);
	    const row = Math.floor(r.y() / size);
	    if (r.fill() === Color.SHELF) {
		let subShelves = [];
		for (let i = 0; i < numSubShelves; i++) {
		    subShelves.push(generateRandomSubShelf());
		}
		data.shelves.push({ x: col, y: row, sub: subShelves });
	    } else if (r.fill() === Color.ENTRANCE) {
		data.entrances.push({ x: col, y: row });
	    }
	});
	// console.log(JSON.stringify(data)); // minimized
	console.log(JSON.stringify(data, null, 2));
	console.log("Export ok.");
    } else {
	console.log("Not exporting.");
    }
}
