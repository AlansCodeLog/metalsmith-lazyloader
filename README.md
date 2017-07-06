# metalsmith-lazyloader
A Metalsmith plugin for adding lazy loading related attributes to images. You can specify the alternative src attribute, add any extra classes you might need, get the image size, replace the src with an invisible svg, append a noscript alternative, and even add some html before and after the image (e.g. to wrap it in a div).

## Installation

```
npm install metalsmith-lazyloader
```

## Usage

```javascript
var metalsmith = require('metalsmith');
var lazyloader = require('metalsmith-lazyloader');

metalsmith
    .use(lazyloader({
        //options
    }))
```

## Options


### `lazy_attribute`
(default `data-src`)

### `clean_cache`
(default `false`)

The first time it runs the program will cache all the results (errors as well). This will clean the cache before starting. Or you can delete the `cache.lazyloader.json` file.


### `fetch_size`
(optional, string)

Attempts to fetch image size both locally and online. If it can't find it, no image width or height attributes are added.

### `lazy_class`
(optional, string)

Add a class to the image. Existing classes are kept.

### `svg`
(optional, boolean)

By default the image src attribute is removed. This option sets the src to the following 1px invisible svg:
```html
data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' %2F%3E
```
If fetch_size is set to true a viewbox will be added to the svg with the width and height attributes of the image.

```html
data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox%3D'0 0 WIDTH HEIGHT' %2F%3E
```

### `force_absolute`
(optional, boolean)

Gives relative/local images an absolute path. Metalsmith's metadata must include a site.url property. 

### `before` / `after`
(optional, string)

Will append the given string before/after the img. Example:

```javascript
before: "<div class=\"lazy-wrapper\">",
after: "</div>"
```
Would return `<div class="lazy-wrapper"><img .../></div>`

### `add_noscript`
(optional, boolean)

Adds the following after the image (but before the after option if set):
```html
<img processed/>
<noscript><img original/></noscript>
```

### `exclude`
(optional, string)

Exclude any image that includes this string. For example if you processed image attributes that this plugin changes with some other plugin and those all have some attribute, class, etc. This shouldn't be needed if the other plugin does not modify an attribute that this plugin does (the `lazy-attribute`, the src if `svg` true, and width and height if `fetch_size` true). All other attributes (including existing classes) are kept.

## To-Do

- [ ] Write tests.
- [ ] Async requests. They are currently synchronous because string replacements and async functions do not mix well.
