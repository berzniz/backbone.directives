var ExampleView = Backbone.View.extend({
    events: {
        'click .increase': 'increase',
        'click .decrease': 'decrease',
        'click .toggle': 'toggle',
        'click .toggle-bold': 'bold',
    },

    initialize: function() {
        this.render();
    },

    increase: function() {
        var value = this.model.get('counter') + 1;
        this.model.set('counter', value);
    },

    decrease: function() {
        var value = this.model.get('counter') - 1;
        this.model.set('counter', value);
    },

    toggle: function() {
        var value = !this.model.get('flag');
        this.model.set('flag', value);
    },

    bold: function() {
        var value = !this.model.get('bold');
        this.model.set('bold', value);
    },

    render: function() {
        this.$compile();
        return this;
    }
});

var bbBindView = new ExampleView({
	el: $('.example.bb-bind'),
	model: new Backbone.Model({ counter: 1 })
});

var bbShowView = new ExampleView({
    el: $('.example.bb-show'),
    model: new Backbone.Model()
});

var bbShowView = new ExampleView({
    el: $('.example.bb-class'),
    model: new Backbone.Model()
});