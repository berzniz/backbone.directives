# Backbone Directives

Give your [Backbone.js](http://documentcloud.github.com/backbone) apps super-powers with AngularJS style directives.

## What/Why?

Everything is explained in this blog post: TBD.

## Demo

Check out the [Demo](http://berzniz.github.io/backbone.directives/example/index.html)

## Status

Please note that this is version 0.0.1 which is only a *proof of concept*.

It work quite nicely, but it is not complete, not optimized for performance and not well tested yet.

## Installation

Just include `backbone.directives.js` after you include backbone.js, it's not AMD/UMD compatible yet.

## Usage

Add directives to your DOM/HTML-templates (as seen in the demo page) and just call `this.$compile()` as the last statement of your view's `render` method.

DOM:

```html
<div class="some-view">
    <span bb-bind="counter"></span>
</div>
```

Javascript:

```js
// Create a new model with a counter attribute
var model = new Backbone.Model({counter: 1});

// Declare a view that calls $compile
var MyView = Backbone.View.extend({
    render: function() {
        this.$compile();
        return this;
    }
});

// Create a new view, with the model and DOM element
var view = new MyView({
    el: $('.some-element'),
    model: model
});

view.render();
```

This is the first and last time you need to call render. Any change in `counter` will be reflected in the UI. 

## Contact

Find me on github: [Tal Bereznitskey](http://github.com/berzniz)

Follow me on Twitter: [@ketacode](https://twitter.com/ketacode)

### ENJOY!
