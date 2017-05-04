const sizeOf = require('image-size');
const request = require('sync-request');
const fs = require('fs-extra');

module.exports = plugin;



function plugin(opts){
    //SETUP CACHE
    if(typeof opts.clean_cache !== "undefined" && opts.clean_cache == true) {
        fs.removeSync('cache.lazyloader.json')
    }
    fs.ensureFileSync('cache.lazyloader.json')
    var cache = fs.readJsonSync('cache.lazyloader.json', { throws: false })
    if (cache == null) {
        cache = {lazyloader:{}}
    }
    function check_cache(src) {
        if (typeof cache.lazyloader !== "undefined" && typeof cache.lazyloader[src] !== "undefined") {
            if (cache.lazyloader[src] == src) {
                console.log("(cached error) Lazy loaded could not find image: " + src)
            }
            return true
        } else {
            return false
        }
    }
    function get_size (src, is_relative) {
        var fetch_src = is_relative ? src.slice(1, src.length) : src
        var dimensions;
        try {
            dimensions = sizeOf(fetch_src)
        } catch (err){
            if (err) {
                if (err.code === 'ENOENT') {
                    console.log("Lazy loaded could not find image: " + src)
                } else {
                    throw err;
                }
                //cache error
                cache.lazyloader = cache.lazyloader || {}
                cache.lazyloader[src] = src
            } else {
                cache.lazyloader = cache.lazyloader || {}
            }
        }
        return dimensions
    }
    function fetch_size (src, is_relative) {
        var fetch_src = is_relative ? src.slice(1, src.length) : src
        var dimensions;
        try {
            var image = request('GET', fetch_src)
            var dimensions = sizeOf(image.body)
        } catch (err){
            if (err) {
                console.log("Lazy loaded could not fetch image: " + fetch_src)
                //cache error
                cache.lazyloader = cache.lazyloader || {}
                cache.lazyloader[src] = src
            } else {
                cache.lazyloader = cache.lazyloader || {}
                console.log("no error");
            }
        }
        if (typeof dimensions !== undefined) {
            return dimensions
        } else {
            return undefined
        }
    }
    return function(files, metalsmith, done){
        Object.keys(files).forEach(function(file){
            post = files[file]
            post.contents = post.contents.toString()
            //Get all images.
            .replace(/<img(.*?)>/g, (match) => {
                //EXCLUSIONS
                //exclude any images with certain string
                if (typeof opts.exclude !== "undefined") {
                    for (property of opts.exclude) {
                        if (match.includes(property)) {
                            return match
                        }
                    }
                }
                //store original match for noscript
                var original = match
                //LAZY CLASS
                if (match.includes("class" && typeof opts.lazy_class !=="undefined" && opts.lazy_class == true )){
                    match = match.replace(/(class=\")/g, "$1"+opts.lazy_class+" ")
                } else {
                    match = match.replace(/img/, "img class=\""+opts.lazy_class+"\"")
                }
                //HANDLE SRC
                match = match.replace(/src=\"(.*?)\"/, function(match, src){
                    //Check cache.
                    if (check_cache(src)){
                        return cache.lazyloader[src]
                    }
                    //Create Basic Replacement
                    var lazy_attribute = typeof opts.lazy_attribute !=="undefined"? opts.lazy_attribute : "data-src"

                    var replacement = lazy_attribute+"=\""+src+"\""
                    if (typeof opts.fetch_size !== "undefined" && opts.fetch_size == true) {
                        //Check if image is relative or local.
                        var is_relative = src.slice(0,1) == "/" ? true : false
                        //if it is, get size locally.
                        if (is_relative || fs.existsSync(src)) {
                            var dimensions = get_size(src, is_relative)
                        } else { //else attempt to fetch image.
                            var dimensions = fetch_size(src, is_relative)
                        }
                        if (typeof dimensions !== "undefined") {//any errors return original match
                            replacement = replacement + " width=\""+dimensions.width+"\" height=\""+dimensions.height+"\""
                        }
                    }
                    //Add Invisible SVG
                    if (typeof opts.svg !== "undefined" && opts.svg == true) {
                        var svg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'"
                        if (typeof opts.fetch_size !== "undefined" && opts.fetch_size == true && typeof dimensions !== "undefined") {
                            svg = svg +" viewBox%3D'0 0 "+dimensions.width+" "+dimensions.height+"'%2F%3E"
                        } else {
                            svg = svg + " %2F%3E"
                        }
                        replacement = replacement + " src=\""+svg+"\""
                    }
                    //Add final replacement to cache.
                    cache.lazyloader[src] =  replacement
                    return replacement
                })
                if (typeof opts.add_noscript !== "undefined" && opts.noscript == true) {
                    match = match + "<noscript>" + original + "</noscript>"
                }
                if (typeof opts.after !=="undefined" &&  opts.after !=="false") {
                    match = match + opts.after
                }
                if (typeof opts.before !=="undefined" &&  opts.before !=="false") {
                    match = opts.before + match
                }
                return match
            })
            post.contents = new Buffer(post.contents)
        })
        fs.writeJsonSync('cache.lazyloader.json', cache)
        done()
    }
}
