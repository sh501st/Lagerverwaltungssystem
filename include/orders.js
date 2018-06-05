const util = require('./util');

// newly generated order consist of up to five randomly chosen
// articles from all available shelves within the provided storage,
// but will not contain any articles which are present in the csv but
// not in the current storage. 'genValid' is used for filling up the
// initial order cache, which is used to fake access patterns to get a
// nice looking heatmap, without increasing the inital order count, so
// a new storage will always begin with order number one.
function generateOrder(storage, genValidID = true) {
    let order = {
	id: (genValidID ? ++storage.orderCounter : -1),
	articles: []
    };
    let numItems = util.randInt(1,5);
    for (let i = 0; i < numItems; i++) {
	let shelf = storage.shelves[util.randInt(0, storage.shelves.length - 1)];
	let article = shelf.sub[util.randInt(0, shelf.sub.length - 1)].article;
	order.articles.push(article);
    }
    return order;
}

// repeatable orders with invalid IDs for visible access pattern,
// otherwise you would get no clear heatmap pattern in a
// pseudoranom scenario
exports.generateOrderCache = (storage, cacheSize = 5) => {
    for (let i = 0; i < cacheSize; i++) {
	storage.orderCache.push(generateOrder(storage, false));
    }
}

// once a new order was generated, add it to the storage's internal
// queue and notify all client which are currenly viewing this storage
// so they can update their order queue list besides the canvas.
function addOrderToQueue(storage, order, notifyObservingClientsCB) {
    if (!order) {
	console.log("No order specified, not adding.");
	return;
    }
    storage.orders.push(order);
    notifyObservingClientsCB(storage);
}

// endless generation of fake orders from imaginary customers. Some
// will not be generated anew but reused from the cache to fight
// pseudo-random access distribution.
exports.generateOrders = (activeStorages, notifyObservingClientsCB) => {
    let f = () => {
	activeStorages.forEach((storage) => {
	    if (storage.orders.length < 8) {
		if (util.randBool(25)) { // 25% chance to recycle cached order
		    let order = Object.assign(
			{}, storage.orderCache[util.randInt(0, storage.orderCache.length - 1)]
		    );
		    order.id = ++storage.orderCounter;
		    addOrderToQueue(storage, order, notifyObservingClientsCB);
		} else {
		    addOrderToQueue(storage, generateOrder(storage), notifyObservingClientsCB);
		}
	    }
	});
	const randDelayInMS = util.randInt(1000, 5000);
	setTimeout(f, randDelayInMS);
    };
    f();
}

// simulated worker handling an order.
exports.takeOrderFromQueue = (storage) => {
    return storage.orders.shift();
}
