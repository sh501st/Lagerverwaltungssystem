const db = require('./db');
const pf = require('./pathfinding');
const util = require('./util');

// querys the db for a set of article ids and associated access over a
// given time range. We transform the original default storage into an
// optimized one by first recursively cloning it and removing all the
// subshelves within each and every regular shelf. Then we refill it
// based on the received log data by picking the closest unfilled
// shelf from each entrance until all articles are in place again.
// Access counter data will be stored within the storage to later
// visualize it in plan.js
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

// write db log access values to associated subshelf
function initAccessValues(storage, dbRows) {
    storage.shelves.forEach((shelf) => {
	shelf.sub.forEach((sub) => {
	    const rowMatch = dbRows.find((row) => row.product == sub.article.id);
	    sub.accessCounter = rowMatch ? rowMatch.accesses : 0;
	});
    });
}

// find out what the maximum access count shelf-wise is to later
// normalize the heatmap colors accordingly
function calcMaxAccessCounter(storage) {
    storage.heatmapMaxAccessCounter = 0;
    storage.shelves.forEach((shelf) => {
	const shelfAccess = shelf.sub.reduce((res, sub) => res + sub.accessCounter, 0);
	if (shelfAccess > storage.heatmapMaxAccessCounter) {
	    storage.heatmapMaxAccessCounter = shelfAccess;
	}
    });
}

// empty out the cloned storage to rearrange afterwards, return the
// cleaned subshelves since we need the same shelf data in the next step.
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

// desc sorted rows (results) come from the db, each row contains
// product/article id and the access count. Here we begin with the
// most frequently accessed subshelf and reassign it into another
// shelf
function fillSubShelvesByAccess(optimizedStorage, subShelves, dbRows) {
    dbRows.forEach((row) => {
	const foundSubShelf = subShelves.find((subShelf) => subShelf.article.id == row.product);
	if (foundSubShelf) {
	    reassignNewSubShelfPosition(optimizedStorage, foundSubShelf);
	}
    });
}

// find closest shelf from entrance that still has empty subshelves
// and move current subshelf into it
function reassignNewSubShelfPosition(optimizedStorage, subShelf) {
    let targetShelf = pf.findNearestAvailableShelf(optimizedStorage);
    subShelf.article.shelfX = targetShelf.x;
    subShelf.article.shelfY = targetShelf.y;
    targetShelf.sub.push(subShelf);
}
