const db = require('./db');
const pf = require('./pathfinding');
const util = require('./util');

exports.rearrangeSubShelves = (storage, fromTime, toTime, callback) => {
    db.sortedAccessesInRange(fromTime, toTime, storage._id, (results) => {
	let optimizedStorage = JSON.parse(JSON.stringify(storage)); // deep clone
	initAccessValues(storage, results);
	initAccessValues(optimizedStorage, results);
	const subShelves = removeAllSubShelves(optimizedStorage);
	fillSubShelvesByAccess(optimizedStorage, subShelves, results);
	calcMaxAccessCounter(storage);
	calcMaxAccessCounter(optimizedStorage);
	callback(optimizedStorage);
    });
}

function initAccessValues(storage, dbRows) {
    storage.shelves.forEach((shelf) => {
	shelf.sub.forEach((sub) => {
	    const rowMatch = dbRows.find((row) => row.product == sub.article.id);
	    sub.accessCounter = rowMatch ? rowMatch.accesses : 0;
	});
    });
}

function calcMaxAccessCounter(storage) {
    storage.heatmapMaxAccessCounter = 0;
    storage.shelves.forEach((shelf) => {
	const shelfAccess = shelf.sub.reduce((res, sub) => res + sub.accessCounter, 0);
	if (shelfAccess > storage.heatmapMaxAccessCounter) {
	    storage.heatmapMaxAccessCounter = shelfAccess;
	}
    });
}

function removeAllSubShelves(optimizedStorage) {
    let subShelves = [];
    optimizedStorage.shelves.forEach((shelf) => {
	shelf.sub.forEach((sub) => {
	    sub.article.shelfX = sub.article.shelfY = -1;
	    subShelves.push(sub);
	});
	shelf.sub = [];
    });
    return subShelves;
}

function fillSubShelvesByAccess(optimizedStorage, subShelves, dbRows) {
    dbRows.forEach((row) => {
	const foundSubShelf = subShelves.find((subShelf) => subShelf.article.id == row.product);
	if (foundSubShelf) {
	    reassignNewSubShelfPosition(optimizedStorage, foundSubShelf);
	}
    });
}

function reassignNewSubShelfPosition(optimizedStorage, subShelf) {
    let targetShelf = pf.findNearestAvailableShelf(optimizedStorage);
    subShelf.article.shelfX = targetShelf.x;
    subShelf.article.shelfY = targetShelf.y;
    targetShelf.sub.push(subShelf);
}
