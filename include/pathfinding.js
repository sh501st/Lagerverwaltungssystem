const util = require('./util');

let storageGridCache;

// all storage entrances are checked against all shelf coords included
// in the specified order
function findClosestEntrance(storage, order) {
    let closestEntrance;
    let minDistance = storage.width + storage.height + 1;
    storage.entrances.forEach((entrance) => {
    order.articles.forEach((article) => {
        const dist = util.manhattanDistance(
        entrance.x, entrance.y, article.shelfX, article.shelfY);
        if (dist < minDistance) {
        minDistance = dist;
        closestEntrace = entrance;
        }
    });
    });
    return closestEntrace;
}

// check nearest shelf from current coordinates repeadately till all
// shelves were visited. Checking's done via tile-wise manhatten
// distance, which will, at least in an usual storage setup, likely
// result in optimal super path.
function appendNearestShelves(path, storage, order) {
    let unvisitedShelfs = order.articles.map((article) => {
    return storage.shelves.find((shelf) => {
        return shelf.x === article.shelfX && shelf.y === article.shelfY;
    })
    });
    while (unvisitedShelfs.length > 0) {
    const currX = path[path.length - 2];
    const currY = path[path.length - 1];
    let closestFromCurrPos;
    let minDistance = storage.width + storage.height + 1;
    unvisitedShelfs.forEach((shelf) => {
        const dist = util.manhattanDistance(currX, currY, shelf.x, shelf.y);
        if (dist < minDistance) {
        minDistance = dist;
        closestFromCurrPos = shelf;
        }
    });
    path.push(closestFromCurrPos.x);
    path.push(closestFromCurrPos.y);
    // also eliminates shelves that hold more than one article
    // from the order
    unvisitedShelfs = unvisitedShelfs.filter((shelf) => {
        return shelf.x !== closestFromCurrPos.x || shelf.y !== closestFromCurrPos.y;
    });
    }
}

// exit chosen based on closed distance from last shelf
function findClosestExit(path, storage) {
    let closestExit;
    minDistance = storage.width + storage.height + 1;
    storage.entrances.forEach((entrance) => {
    const currX = path[path.length - 2];
    const currY = path[path.length - 1];
    const dist = util.manhattanDistance(entrance.x, entrance.y, currX, currY);
    if (dist < minDistance) {
        minDistance = dist;
        closestExit = entrance;
    }
    });
    return closestExit;
}

// find optimal sub paths between two shelves or shelves and entrances
// while checking for non-walkable obstracles. Merge given super and
// optimal sub paths into a single worker path.
function getInterpolatedPath(path, storage, closestExit) {
    let interpolatedPath = [];
    while (path.length >= 4) {
    const x1 = path.shift(),
          y1 = path.shift(),
          x2 = path[0],
          y2 = path[1];
    let subPath = tilePathBetweenCoords(storage, x1, y1, x2, y2);
    // since shelf is not walkable, reset to adjecent tile.
    // Additional check necessary in case worker takes two items
    // from same shelf, in that case we are not moving around.
    if (subPath && subPath.length === 0) {
        path[0] = x1;
        path[1] = y1;
    } else if (subPath && subPath.length >= 2) {
        path[0] = subPath[subPath.length - 2];
        path[1] = subPath[subPath.length - 1];
    }
    // create subpaths so that we can play an access animation on
    // the associated shelf while the worker is waiting a bit
    if (subPath && subPath.length > 0) {
        interpolatedPath.push(subPath);
    }
    }
    // add exit bit, otherwise worker would disappear one tile away
    // from the exit
    if (interpolatedPath.length >= 1) {
    const lastSubPath = interpolatedPath[interpolatedPath.length - 1];
    if (lastSubPath.length >= 2) {
        const lastX = lastSubPath[lastSubPath.length - 2];
        const lastY = lastSubPath[lastSubPath.length - 1];
        interpolatedPath.push([lastX, lastY, closestExit.x, closestExit.y]);
    }
    }
    return interpolatedPath;
}


// try to find a rather efficient path for the worker to take, but not
// necessarily the shortest path possible since we're only checking
// shortest manhatten distance for the next shelf to go to and are not
// taking into account which duplication could be avoided due to one
// being along the way of another shelf.
exports.generateWorkerPath = (storage, order) => {
    // first step: rough super path without collision avoidance
    const closestEntrace = findClosestEntrance(storage, order);
    let path = [closestEntrace.x, closestEntrace.y];
    appendNearestShelves(path, storage, order);
    const closestExit = findClosestExit(path, storage);
    path.push(closestExit.x, closestExit.y);

    // second step: find optimal tile based sub paths between closest
    // shelves, respecting non-walkable areas.
    return getInterpolatedPath(path, storage, closestExit);
};

function resetVisitFlagForAllTiles(grid) {
    for (let col = 0; col < grid.length; col++) {
    for (let row = 0; row < grid[0].length; row++) {
        grid[col][row].visited = false;
    }
    }
}

// TODO: invalidate old cache once we support modifiable storages
function getCachedGrid(storage) {
    if (!storageGridCache) {
    storageGridCache = new Map();
    }
    let grid = storageGridCache.get(storage._id);
    if (!grid) {
    grid = generateGridRepresentation(storage);
    }
    return grid;
}

// find shortest valid path between two shelves or between a shelf and
// an entrance and note every tile for client-wise worker traversal.
// For the sake of a simpler implementation breadth-first was chosen
// instead of a-star, but could change if performance requires it in
// the future (for now not necessary at all).
function tilePathBetweenCoords(storage, x1, y1, x2, y2) {
    let grid = getCachedGrid(storage);
    resetVisitFlagForAllTiles(grid);
    let queue = [{ x:x1, y:y1 }];
    let parents = new Map();

    // tile based breath-first search
    let walkPath;
    let visit = (parent, cx, cy) => {
    if (cx == x2 && cy == y2) {
        // target shelf/exit found, traverse tree upwards to build
        // walking path tile by tile. Don't add target note since
        // it's not walkable.
        walkPath = [];
        while (parent.x !== x1 || parent.y !== y1) {
        walkPath.push(parent.y);
        walkPath.push(parent.x);
        parent = parents.get(parent);
        }
        walkPath.push(y1);
        walkPath.push(x1);
        walkPath.reverse();
    }
    else if (!(grid[cx][cy].visited) && grid[cx][cy].walkable) {
        const child = { x:cx, y:cy };
        queue.push(child);
        parents.set(child, parent);
        grid[cx][cy].visited = true;
    }
    };

    while (queue.length > 0 && !walkPath) {
    let node = queue.shift();
    if (node.x > 0) { visit(node, node.x - 1, node.y); } // left
    if (node.x < storage.width - 1) { visit(node, node.x + 1, node.y); } // right
    if (node.y > 0) { visit(node, node.x, node.y - 1); } // up
    if (node.y < storage.height - 1) { visit(node, node.x, node.y + 1); } // down
    }
    return walkPath;
}

// 2d array representation for constant-time lookup in tight loops
// like path interpolation and finding nearest available subshelves.
function generateGridRepresentation(storage, shouldCache = true) {
    const numSubShelvesPerShelf = 4;
    let grid = [];
    for (let col = 0; col < storage.width; col++) {
    grid[col] = [];
    for (let row = 0; row < storage.height; row++) {
        grid[col][row] = { visited: false, walkable: true, availableSubs: 0 };
    }
    }
    storage.shelves.forEach((shelf) => {
    grid[shelf.x][shelf.y].walkable = false;
    grid[shelf.x][shelf.y].availableSubs = numSubShelvesPerShelf - shelf.sub.length;
    });

    if (shouldCache) {
    storageGridCache.set(storage._id, grid);
    }
    return grid;
}

// find (starting at the entrance positions) and return the first
// shelf that has still at least one free subshelf. Breath-first
// search approach without backwards pathwalking since we only care
// about the target, not the path. There is no thresholding for now
// which could lead to an order being split up between to different
// entrances.
exports.findNearestAvailableShelf = (storage) => {
    let grid = generateGridRepresentation(storage, false);
    let queue = [];
    storage.entrances.forEach((ent) => {
    queue.push({ x: ent.x, y: ent.y });
    });

    let foundShelf;
    let visit = (x, y) => {
    let tile = grid[x][y];
    if (tile.availableSubs > 0 && !foundShelf) {
        foundShelf = storage.shelves.find(
        (shelf) => shelf.x === x && shelf.y === y);
    } else if (!tile.visited && tile.walkable) {
        queue.push({ x:x, y:y });
        tile.visited = true;
    }
    };

    while (queue.length > 0 && !foundShelf) {
    const node = queue.shift();
    if (node.x > 0) { visit(node.x - 1, node.y); } // left
    if (node.x < storage.width - 1) { visit(node.x + 1, node.y); } // right
    if (node.y > 0) { visit(node.x, node.y - 1); } // up
    if (node.y < storage.height - 1) { visit(node.x, node.y + 1); } // down
    }
    return foundShelf;
}
