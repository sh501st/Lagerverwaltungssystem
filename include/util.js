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
