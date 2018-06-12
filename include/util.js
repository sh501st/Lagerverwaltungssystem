// random ranged integer, both inclusive
exports.randInt = (from, to) => {
    return Math.floor(Math.random() * (to - from + 1) + from);
}

// weighted random bool, used for order cache reuse
exports.randBool = (percent = 50) => {
    return Math.random() * 100 < percent;
}

// current unix time in seconds
exports.unix = () => Math.round((new Date).getTime()/1000);

// Tile distance between two coords when only allowed to walk
// directions up, down, left or right.
exports.manhattanDistance = (fromX, fromY, toX, toY) => {
    return Math.abs(toX - fromX) + Math.abs(toY - fromY);
}
