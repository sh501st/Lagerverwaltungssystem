// simply return copy for now
exports.sortSubShelvesByAccess = (storage, fromTime, toTime) => {
    console.log('Storage "' + storage._id + '" optimized');
    return Object.assign({}, storage);
}
