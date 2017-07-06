const sizeOf = require('image-size');
const request = require('sync-request');
const fs = require('fs-extra');
const isLocal = require("url-local");
const path = require('path');

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
            if (cache.lazyloader[src] == "error") {
                console.log("Lazyloader cached error on image: " + src)
            }
            return true
        } else {
            return false
        }
    }
    function get_size (src, original) {
        var dimensions;
        var local = false;
        try {
            if (isLocal(src)) {
                local = true
                dimensions = sizeOf(path.join(process.env.PWD, src))
            } else {
                var image = request('GET', src)
                var dimensions = sizeOf(image.body)
            }
        } catch (err){
            handle(err)
        }
        function handle (err) {
            if (err) {
                //cache error
                cache.lazyloader = cache.lazyloader || {}
                cache.lazyloader[src] = "error"
                if (local && err.code === 'ENOENT') {
                    console.log("Lazyloader could not find image: " + src, err.message)
                } else if (!local && err.message.indexOf("ECONNREFUSED") !== -1) {
                    console.log("Lazyloader could not fetch image, connection refused: " + src)
                } else if (err.message.indexOf("unsupported file type") !== -1) {
                    console.log("Lazyloader could read this image, the format is unsupported : " + src)
                } else if (err.message.indexOf("Index out of range") !== -1) {
                    console.log("Lazyloader could read this image, it's likely the file is corrupt: " + src)
                } else {
                    console.log(src)
                    throw err
                }
            } else {
                cache.lazyloader = cache.lazyloader || {}
            }
        }
        return dimensions
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
                if (typeof opts.lazy_class !=="undefined" && opts.lazy_class == true) {
                    if (match.includes("class")){
                        match = match.replace(/(class=\")/g, "$1"+opts.lazy_class+" ")
                    } else {
                        match = match.replace(/img/, "img class=\""+opts.lazy_class+"\"")
                    }
                }
                //HANDLE SRC
                match = match.replace(/src=\"(.*?)\"/, function(match, src){
                    //Check cache.
                    if (check_cache(src)){
                        return cache.lazyloader[src]
                    }
                    //Create Basic Replacement
                    var lazy_attribute = typeof opts.lazy_attribute !=="undefined"? opts.lazy_attribute : "data-src"
                    if (typeof opts.force_absolute !== "undefined" && opts.force_absolute == true && typeof metalsmith._metadata.site.url !== "undefined") {
                        var replacement = lazy_attribute+"=\""+metalsmith._metadata.site.url+src+"\""

                    } else {
                        var replacement = lazy_attribute+"=\""+src+"\""
                    }
                    if (typeof opts.fetch_size !== "undefined" && opts.fetch_size == true) {
                        //Check if image is relative or local.
                        //if it is, get size locally.
                        var dimensions = get_size(src, original)
                        if (typeof dimensions !== "undefined") {//any errors return original match
                            replacement = replacement + " width=\""+dimensions.width+"\" height=\""+dimensions.height+"\""
                        } else {
                            return match
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
