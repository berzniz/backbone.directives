(function() {
    "use strict";

    // -------------------------------------------------------------
    // Backbone Directives 0.0.1
    // -------------------------------------------------------------

    Backbone.View.prototype = _.extend(Backbone.View.prototype, {
        $compile: function() {
            var view = this;
            var model = this.model;
            _.each(Backbone.Directives, function(link_func, directive) {
                this.$('[' + directive + ']').each(function() {
                    link_func.call(view, model, $(this));
                });
            }, this);
        },

        $watch: function(model, func, event) {
            event = event || 'change';
            this.listenTo(model, event, func);
            func();
        }

    });

    Backbone.Directives = {};

    var $register_simple_directive = function(name, func) {
        Backbone.Directives[name] = function(model, $el) {
            var attr = $el.attr(name);
            var expr = compile(attr);
            this.$watch(model, function() {
                func(model, $el, expr);
            });
        };
    };

    var $expr_from_template = function(template) {
        var source = '"' + template.replace(/{{/g, '" + (').replace(/}}/g, ') + "') + '"';
        return compile(source);
    };

    $register_simple_directive('bb-show', function(model, $el, expr) {
        var show = !!expr(model.toJSON());
        $el.toggle(show);
    });

    $register_simple_directive('bb-bind', function(model, $el, expr) {
        var value = expr(model.toJSON());
        $el.text(_.isUndefined(value) ? '' : value);
    });

    Backbone.Directives['bb-src'] = function(model, $el) {
        var name = 'bb-src';
        var expr = $expr_from_template($el.attr(name));
        this.$watch(model, function() {
            var src = expr(model.toJSON());
            $el.attr('src', src);
        });
    };

    Backbone.Directives['bb-class'] = function(model, $el) {
        var name = 'bb-class';
        var attr = $el.attr(name);
        var expr = compile(attr);
        this.$watch(model, function() {
            var map = expr(model.toJSON());
            _.each(map, function(value, className) {
                $el.toggleClass(className, !!value);
            }, this);
        });
    };

    Backbone.Directives['bb-model'] = function(model, $el) {
        var _this = this;
        var name = 'bb-model';
        var attr = $el.attr(name);
        var changeEvent = 'change:' + attr;
        var isTextField = !$el.attr('type') || ($el.attr('type') == 'text') || ($el.attr('type') == 'password');
        var changeFunction = function() {
            var value = _this.model.get(attr);
            var tagName = $el.prop('tagName');
            if (tagName == 'SELECT') {
                $el.val(value);
            } else if ($el.attr('type') == 'checkbox') {
                $el.prop('checked', value);
            } else if ($el.attr('type') == 'radio') {
                (value == $el.val()) && $el.prop('checked', true);
            } else if (tagName == 'INPUT') {
                $el.val(value);
            }
        };
        this.$watch(model, changeFunction, changeEvent);

        var updateModel = function(attr, value, silent) {
            if (_.isBoolean(value) || (_.isString(value) && value.length > 0)) {
                if (value == parseInt(value, 10)) {
                    value = parseInt(value, 10);
                }
                _this.model.set(attr, value, {
                    silent: silent
                });
            } else {
                _this.model.unset(attr, {
                    silent: silent
                });
            }
        };

        $el.on('change', function() {
            var value = ($el.attr('type') == 'checkbox') ? $el.is(':checked') : $el.val();
            updateModel(attr, value, false);
        });
        if (isTextField) {
            $el.on('keyup', function(e) {
                e = e || event;
                var tabKeyCode = 9;
                if (e.keyCode == tabKeyCode) {
                    return;
                }
                var value = $el.val();
                updateModel(attr, value, false);
            }).on('blur', function() {
                var value = $el.val();
                updateModel(attr, value, false);
            });            
        } else if ($el.attr('type') == 'radio') {
            $el.on('click', function() {
                var value = $(this).val();
                updateModel(attr, value, false);
            });
        }

    };

    


    // ------
    // Angluar Expressions
    // ------

    // Angular environment stuff
    // ------------------------------
    function noop() {}

    // Simplified extend() for our use-case
    function extend(dst, obj) {
        var key;

        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                dst[key] = obj[key];
            }
        }

        return dst;
    }

    function isDefined(value) { return typeof value !== 'undefined'; }

    function valueFn(value) { return function () { return value; }; }

    function $parseMinErr(module, message, arg1, arg2, arg3) {
        var args = arguments;

        message = message.replace(/{(\d)}/g, function (match) {
            return args[2 + parseInt(match[1])];
        });

        throw new SyntaxError(message);
    }

    function lowercase (string) {return typeof string === "string" ? string.toLowerCase() : string;}

    // Simplified forEach() for our use-case
    function forEach(arr, iterator) {
        arr.forEach(iterator);
    }

    // Sandboxing Angular Expressions
    // ------------------------------
    // Angular expressions are generally considered safe because these expressions only have direct
    // access to $scope and locals. However, one can obtain the ability to execute arbitrary JS code by
    // obtaining a reference to native JS functions such as the Function constructor.
    //
    // As an example, consider the following Angular expression:
    //
    //   {}.toString.constructor(alert("evil JS code"))
    //
    // We want to prevent this type of access. For the sake of performance, during the lexing phase we
    // disallow any "dotted" access to any member named "constructor".
    //
    // For reflective calls (a[b]) we check that the value of the lookup is not the Function constructor
    // while evaluating the expression, which is a stronger but more expensive test. Since reflective
    // calls are expensive anyway, this is not such a big deal compared to static dereferencing.
    //
    // This sandboxing technique is not perfect and doesn't aim to be. The goal is to prevent exploits
    // against the expression language, but not to prevent exploits that were enabled by exposing
    // sensitive JavaScript or browser apis on Scope. Exposing such objects on a Scope is never a good
    // practice and therefore we are not even trying to protect against interaction with an object
    // explicitly exposed in this way.
    //
    // A developer could foil the name check by aliasing the Function constructor under a different
    // name on the scope.
    //
    // In general, it is not possible to access a Window object from an angular expression unless a
    // window or some DOM object that has a reference to window is published onto a Scope.

    function ensureSafeMemberName(name, fullExpression) {
      if (name === "constructor") {
        throw $parseMinErr('isecfld',
            'Referencing "constructor" field in Angular expressions is disallowed! Expression: {0}',
            fullExpression);
      }
      return name;
    }

    function ensureSafeObject(obj, fullExpression) {
      // nifty check if obj is Function that is fast and works across iframes and other contexts
      if (obj) {
        if (obj.constructor === obj) {
          throw $parseMinErr('isecfn',
              'Referencing Function in Angular expressions is disallowed! Expression: {0}',
              fullExpression);
        } else if (// isWindow(obj)
            obj.document && obj.location && obj.alert && obj.setInterval) {
          throw $parseMinErr('isecwindow',
              'Referencing the Window in Angular expressions is disallowed! Expression: {0}',
              fullExpression);
        } else if (// isElement(obj)
            obj.children && (obj.nodeName || (obj.prop && obj.attr && obj.find))) {
          throw $parseMinErr('isecdom',
              'Referencing DOM nodes in Angular expressions is disallowed! Expression: {0}',
              fullExpression);
        }
      }
      return obj;
    }

    var OPERATORS = {
        /* jshint bitwise : false */
        'null':function(){return null;},
        'true':function(){return true;},
        'false':function(){return false;},
        undefined:noop,
        '+':function(self, locals, a,b){
          a=a(self, locals); b=b(self, locals);
          if (isDefined(a)) {
            if (isDefined(b)) {
              return a + b;
            }
            return a;
          }
          return isDefined(b)?b:undefined;},
        '-':function(self, locals, a,b){
              a=a(self, locals); b=b(self, locals);
              return (isDefined(a)?a:0)-(isDefined(b)?b:0);
            },
        '*':function(self, locals, a,b){return a(self, locals)*b(self, locals);},
        '/':function(self, locals, a,b){return a(self, locals)/b(self, locals);},
        '%':function(self, locals, a,b){return a(self, locals)%b(self, locals);},
        '^':function(self, locals, a,b){return a(self, locals)^b(self, locals);},
        '=':noop,
        '===':function(self, locals, a, b){return a(self, locals)===b(self, locals);},
        '!==':function(self, locals, a, b){return a(self, locals)!==b(self, locals);},
        '==':function(self, locals, a,b){return a(self, locals)==b(self, locals);},
        '!=':function(self, locals, a,b){return a(self, locals)!=b(self, locals);},
        '<':function(self, locals, a,b){return a(self, locals)<b(self, locals);},
        '>':function(self, locals, a,b){return a(self, locals)>b(self, locals);},
        '<=':function(self, locals, a,b){return a(self, locals)<=b(self, locals);},
        '>=':function(self, locals, a,b){return a(self, locals)>=b(self, locals);},
        '&&':function(self, locals, a,b){return a(self, locals)&&b(self, locals);},
        '||':function(self, locals, a,b){return a(self, locals)||b(self, locals);},
        '&':function(self, locals, a,b){return a(self, locals)&b(self, locals);},
    //    '|':function(self, locals, a,b){return a|b;},
        '|':function(self, locals, a,b){return b(self, locals)(self, locals, a(self, locals));},
        '!':function(self, locals, a){return !a(self, locals);}
    };
    /* jshint bitwise: true */
    var ESCAPE = {"n":"\n", "f":"\f", "r":"\r", "t":"\t", "v":"\v", "'":"'", '"':'"'};


    /////////////////////////////////////////


    /**
     * @constructor
     */
    var Lexer = function (options) {
      this.options = options;
    };

    Lexer.prototype = {
      constructor: Lexer,

      lex: function (text) {
        this.text = text;

        this.index = 0;
        this.ch = undefined;
        this.lastCh = ':'; // can start regexp

        this.tokens = [];

        var token;
        var json = [];

        while (this.index < this.text.length) {
          this.ch = this.text.charAt(this.index);
          if (this.is('"\'')) {
            this.readString(this.ch);
          } else if (this.isNumber(this.ch) || this.is('.') && this.isNumber(this.peek())) {
            this.readNumber();
          } else if (this.isIdent(this.ch)) {
            this.readIdent();
            // identifiers can only be if the preceding char was a { or ,
            if (this.was('{,') && json[0] === '{' &&
                (token = this.tokens[this.tokens.length - 1])) {
              token.json = token.text.indexOf('.') === -1;
            }
          } else if (this.is('(){}[].,;:?')) {
            this.tokens.push({
              index: this.index,
              text: this.ch,
              json: (this.was(':[,') && this.is('{[')) || this.is('}]:,')
            });
            if (this.is('{[')) json.unshift(this.ch);
            if (this.is('}]')) json.shift();
            this.index++;
          } else if (this.isWhitespace(this.ch)) {
            this.index++;
            continue;
          } else {
            var ch2 = this.ch + this.peek();
            var ch3 = ch2 + this.peek(2);
            var fn = OPERATORS[this.ch];
            var fn2 = OPERATORS[ch2];
            var fn3 = OPERATORS[ch3];
            if (fn3) {
              this.tokens.push({index: this.index, text: ch3, fn: fn3});
              this.index += 3;
            } else if (fn2) {
              this.tokens.push({index: this.index, text: ch2, fn: fn2});
              this.index += 2;
            } else if (fn) {
              this.tokens.push({
                index: this.index,
                text: this.ch,
                fn: fn,
                json: (this.was('[,:') && this.is('+-'))
              });
              this.index += 1;
            } else {
              this.throwError('Unexpected next character ', this.index, this.index + 1);
            }
          }
          this.lastCh = this.ch;
        }
        return this.tokens;
      },

      is: function(chars) {
        return chars.indexOf(this.ch) !== -1;
      },

      was: function(chars) {
        return chars.indexOf(this.lastCh) !== -1;
      },

      peek: function(i) {
        var num = i || 1;
        return (this.index + num < this.text.length) ? this.text.charAt(this.index + num) : false;
      },

      isNumber: function(ch) {
        return ('0' <= ch && ch <= '9');
      },

      isWhitespace: function(ch) {
        // IE treats non-breaking space as \u00A0
        return (ch === ' ' || ch === '\r' || ch === '\t' ||
                ch === '\n' || ch === '\v' || ch === '\u00A0');
      },

      isIdent: function(ch) {
        return ('a' <= ch && ch <= 'z' ||
                'A' <= ch && ch <= 'Z' ||
                '_' === ch || ch === '$');
      },

      isExpOperator: function(ch) {
        return (ch === '-' || ch === '+' || this.isNumber(ch));
      },

      throwError: function(error, start, end) {
        end = end || this.index;
        var colStr = (isDefined(start)
                ? 's ' + start +  '-' + this.index + ' [' + this.text.substring(start, end) + ']'
                : ' ' + end);
        throw $parseMinErr('lexerr', 'Lexer Error: {0} at column{1} in expression [{2}].',
            error, colStr, this.text);
      },

      readNumber: function() {
        var number = '';
        var start = this.index;
        while (this.index < this.text.length) {
          var ch = lowercase(this.text.charAt(this.index));
          if (ch == '.' || this.isNumber(ch)) {
            number += ch;
          } else {
            var peekCh = this.peek();
            if (ch == 'e' && this.isExpOperator(peekCh)) {
              number += ch;
            } else if (this.isExpOperator(ch) &&
                peekCh && this.isNumber(peekCh) &&
                number.charAt(number.length - 1) == 'e') {
              number += ch;
            } else if (this.isExpOperator(ch) &&
                (!peekCh || !this.isNumber(peekCh)) &&
                number.charAt(number.length - 1) == 'e') {
              this.throwError('Invalid exponent');
            } else {
              break;
            }
          }
          this.index++;
        }
        number = 1 * number;
        this.tokens.push({
          index: start,
          text: number,
          json: true,
          fn: function() { return number; }
        });
      },

      readIdent: function() {
        var parser = this;

        var ident = '';
        var start = this.index;

        var lastDot, peekIndex, methodName, ch;

        while (this.index < this.text.length) {
          ch = this.text.charAt(this.index);
          if (ch === '.' || this.isIdent(ch) || this.isNumber(ch)) {
            if (ch === '.') lastDot = this.index;
            ident += ch;
          } else {
            break;
          }
          this.index++;
        }

        //check if this is not a method invocation and if it is back out to last dot
        if (lastDot) {
          peekIndex = this.index;
          while (peekIndex < this.text.length) {
            ch = this.text.charAt(peekIndex);
            if (ch === '(') {
              methodName = ident.substr(lastDot - start + 1);
              ident = ident.substr(0, lastDot - start);
              this.index = peekIndex;
              break;
            }
            if (this.isWhitespace(ch)) {
              peekIndex++;
            } else {
              break;
            }
          }
        }


        var token = {
          index: start,
          text: ident
        };

        // OPERATORS is our own object so we don't need to use special hasOwnPropertyFn
        if (OPERATORS.hasOwnProperty(ident)) {
          token.fn = OPERATORS[ident];
          token.json = OPERATORS[ident];
        } else {
          var getter = getterFn(ident, this.options, this.text);
          token.fn = extend(function(self, locals) {
            return (getter(self, locals));
          }, {
            assign: function(self, value) {
              return setter(self, ident, value, parser.text, parser.options);
            }
          });
        }

        this.tokens.push(token);

        if (methodName) {
          this.tokens.push({
            index:lastDot,
            text: '.',
            json: false
          });
          this.tokens.push({
            index: lastDot + 1,
            text: methodName,
            json: false
          });
        }
      },

      readString: function(quote) {
        var start = this.index;
        this.index++;
        var string = '';
        var rawString = quote;
        var escape = false;
        while (this.index < this.text.length) {
          var ch = this.text.charAt(this.index);
          rawString += ch;
          if (escape) {
            if (ch === 'u') {
              var hex = this.text.substring(this.index + 1, this.index + 5);
              if (!hex.match(/[\da-f]{4}/i))
                this.throwError('Invalid unicode escape [\\u' + hex + ']');
              this.index += 4;
              string += String.fromCharCode(parseInt(hex, 16));
            } else {
              var rep = ESCAPE[ch];
              if (rep) {
                string += rep;
              } else {
                string += ch;
              }
            }
            escape = false;
          } else if (ch === '\\') {
            escape = true;
          } else if (ch === quote) {
            this.index++;
            this.tokens.push({
              index: start,
              text: rawString,
              string: string,
              json: true,
              fn: function() { return string; }
            });
            return;
          } else {
            string += ch;
          }
          this.index++;
        }
        this.throwError('Unterminated quote', start);
      }
    };


    /**
     * @constructor
     */
    var Parser = function (lexer, $filter, options) {
      this.lexer = lexer;
      this.$filter = $filter;
      this.options = options;
    };

    Parser.ZERO = function () { return 0; };

    Parser.prototype = {
      constructor: Parser,

      parse: function (text) {
        this.text = text;

        this.tokens = this.lexer.lex(text);

        var value = this.statements();

        if (this.tokens.length !== 0) {
          this.throwError('is an unexpected token', this.tokens[0]);
        }

        value.literal = !!value.literal;
        value.constant = !!value.constant;

        return value;
      },

      primary: function () {
        var primary;
        if (this.expect('(')) {
          primary = this.filterChain();
          this.consume(')');
        } else if (this.expect('[')) {
          primary = this.arrayDeclaration();
        } else if (this.expect('{')) {
          primary = this.object();
        } else {
          var token = this.expect();
          primary = token.fn;
          if (!primary) {
            this.throwError('not a primary expression', token);
          }
          if (token.json) {
            primary.constant = true;
            primary.literal = true;
          }
        }

        var next, context;
        while ((next = this.expect('(', '[', '.'))) {
          if (next.text === '(') {
            primary = this.functionCall(primary, context);
            context = null;
          } else if (next.text === '[') {
            context = primary;
            primary = this.objectIndex(primary);
          } else if (next.text === '.') {
            context = primary;
            primary = this.fieldAccess(primary);
          } else {
            this.throwError('IMPOSSIBLE');
          }
        }
        return primary;
      },

      throwError: function(msg, token) {
        throw $parseMinErr('syntax',
            'Syntax Error: Token \'{0}\' {1} at column {2} of the expression [{3}] starting at [{4}].',
              token.text, msg, (token.index + 1), this.text, this.text.substring(token.index));
      },

      peekToken: function() {
        if (this.tokens.length === 0)
          throw $parseMinErr('ueoe', 'Unexpected end of expression: {0}', this.text);
        return this.tokens[0];
      },

      peek: function(e1, e2, e3, e4) {
        if (this.tokens.length > 0) {
          var token = this.tokens[0];
          var t = token.text;
          if (t === e1 || t === e2 || t === e3 || t === e4 ||
              (!e1 && !e2 && !e3 && !e4)) {
            return token;
          }
        }
        return false;
      },

      expect: function(e1, e2, e3, e4){
        var token = this.peek(e1, e2, e3, e4);
        if (token) {
          this.tokens.shift();
          return token;
        }
        return false;
      },

      consume: function(e1){
        if (!this.expect(e1)) {
          this.throwError('is unexpected, expecting [' + e1 + ']', this.peek());
        }
      },

      unaryFn: function(fn, right) {
        return extend(function(self, locals) {
          return fn(self, locals, right);
        }, {
          constant:right.constant
        });
      },

      ternaryFn: function(left, middle, right){
        return extend(function(self, locals){
          return left(self, locals) ? middle(self, locals) : right(self, locals);
        }, {
          constant: left.constant && middle.constant && right.constant
        });
      },

      binaryFn: function(left, fn, right) {
        return extend(function(self, locals) {
          return fn(self, locals, left, right);
        }, {
          constant:left.constant && right.constant
        });
      },

      statements: function() {
        var statements = [];
        while (true) {
          if (this.tokens.length > 0 && !this.peek('}', ')', ';', ']'))
            statements.push(this.filterChain());
          if (!this.expect(';')) {
            // optimize for the common case where there is only one statement.
            // TODO(size): maybe we should not support multiple statements?
            return (statements.length === 1)
                ? statements[0]
                : function(self, locals) {
                    var value;
                    for (var i = 0; i < statements.length; i++) {
                      var statement = statements[i];
                      if (statement) {
                        value = statement(self, locals);
                      }
                    }
                    return value;
                  };
          }
        }
      },

      filterChain: function() {
        var left = this.expression();
        var token;
        while (true) {
          if ((token = this.expect('|'))) {
            left = this.binaryFn(left, token.fn, this.filter());
          } else {
            return left;
          }
        }
      },

      filter: function() {
        var token = this.expect();
        var fn = this.$filter(token.text);
        var argsFn = [];
        while (true) {
          if ((token = this.expect(':'))) {
            argsFn.push(this.expression());
          } else {
            var fnInvoke = function(self, locals, input) {
              var args = [input];
              for (var i = 0; i < argsFn.length; i++) {
                args.push(argsFn[i](self, locals));
              }
              return fn.apply(self, args);
            };
            return function() {
              return fnInvoke;
            };
          }
        }
      },

      expression: function() {
        return this.assignment();
      },

      assignment: function() {
        var left = this.ternary();
        var right;
        var token;
        if ((token = this.expect('='))) {
          if (!left.assign) {
            this.throwError('implies assignment but [' +
                this.text.substring(0, token.index) + '] can not be assigned to', token);
          }
          right = this.ternary();
          return function(scope, locals) {
            return left.assign(scope, right(scope, locals), locals);
          };
        }
        return left;
      },

      ternary: function() {
        var left = this.logicalOR();
        var middle;
        var token;
        if ((token = this.expect('?'))) {
          middle = this.ternary();
          if ((token = this.expect(':'))) {
            return this.ternaryFn(left, middle, this.ternary());
          } else {
            this.throwError('expected :', token);
          }
        } else {
          return left;
        }
      },

      logicalOR: function() {
        var left = this.logicalAND();
        var token;
        while (true) {
          if ((token = this.expect('||'))) {
            left = this.binaryFn(left, token.fn, this.logicalAND());
          } else {
            return left;
          }
        }
      },

      logicalAND: function() {
        var left = this.equality();
        var token;
        if ((token = this.expect('&&'))) {
          left = this.binaryFn(left, token.fn, this.logicalAND());
        }
        return left;
      },

      equality: function() {
        var left = this.relational();
        var token;
        if ((token = this.expect('==','!=','===','!=='))) {
          left = this.binaryFn(left, token.fn, this.equality());
        }
        return left;
      },

      relational: function() {
        var left = this.additive();
        var token;
        if ((token = this.expect('<', '>', '<=', '>='))) {
          left = this.binaryFn(left, token.fn, this.relational());
        }
        return left;
      },

      additive: function() {
        var left = this.multiplicative();
        var token;
        while ((token = this.expect('+','-'))) {
          left = this.binaryFn(left, token.fn, this.multiplicative());
        }
        return left;
      },

      multiplicative: function() {
        var left = this.unary();
        var token;
        while ((token = this.expect('*','/','%'))) {
          left = this.binaryFn(left, token.fn, this.unary());
        }
        return left;
      },

      unary: function() {
        var token;
        if (this.expect('+')) {
          return this.primary();
        } else if ((token = this.expect('-'))) {
          return this.binaryFn(Parser.ZERO, token.fn, this.unary());
        } else if ((token = this.expect('!'))) {
          return this.unaryFn(token.fn, this.unary());
        } else {
          return this.primary();
        }
      },

      fieldAccess: function(object) {
        var parser = this;
        var field = this.expect().text;
        var getter = getterFn(field, this.options, this.text);

        return extend(function(scope, locals, self) {
          return getter(self || object(scope, locals));
        }, {
          assign: function(scope, value, locals) {
            return setter(object(scope, locals), field, value, parser.text, parser.options);
          }
        });
      },

      objectIndex: function(obj) {
        var parser = this;

        var indexFn = this.expression();
        this.consume(']');

        return extend(function(self, locals) {
          var o = obj(self, locals),
              i = indexFn(self, locals),
              v, p;

          if (!o) return undefined;
          v = ensureSafeObject(o[i], parser.text);
          return v;
        }, {
          assign: function(self, value, locals) {
            var key = indexFn(self, locals);
            // prevent overwriting of Function.constructor which would break ensureSafeObject check
            var safe = ensureSafeObject(obj(self, locals), parser.text);
            return safe[key] = value;
          }
        });
      },

      functionCall: function(fn, contextGetter) {
        var argsFn = [];
        if (this.peekToken().text !== ')') {
          do {
            argsFn.push(this.expression());
          } while (this.expect(','));
        }
        this.consume(')');

        var parser = this;

        return function(scope, locals) {
          var args = [];
          var context = contextGetter ? contextGetter(scope, locals) : scope;

          for (var i = 0; i < argsFn.length; i++) {
            args.push(argsFn[i](scope, locals));
          }
          var fnPtr = fn(scope, locals, context) || noop;

          ensureSafeObject(context, parser.text);
          ensureSafeObject(fnPtr, parser.text);

          // IE stupidity! (IE doesn't have apply for some native functions)
          var v = fnPtr.apply
                ? fnPtr.apply(context, args)
                : fnPtr(args[0], args[1], args[2], args[3], args[4]);

          return ensureSafeObject(v, parser.text);
        };
      },

      // This is used with json array declaration
      arrayDeclaration: function () {
        var elementFns = [];
        var allConstant = true;
        if (this.peekToken().text !== ']') {
          do {
            if (this.peek(']')) {
              // Support trailing commas per ES5.1.
              break;
            }
            var elementFn = this.expression();
            elementFns.push(elementFn);
            if (!elementFn.constant) {
              allConstant = false;
            }
          } while (this.expect(','));
        }
        this.consume(']');

        return extend(function(self, locals) {
          var array = [];
          for (var i = 0; i < elementFns.length; i++) {
            array.push(elementFns[i](self, locals));
          }
          return array;
        }, {
          literal: true,
          constant: allConstant
        });
      },

      object: function () {
        var keyValues = [];
        var allConstant = true;
        if (this.peekToken().text !== '}') {
          do {
            if (this.peek('}')) {
              // Support trailing commas per ES5.1.
              break;
            }
            var token = this.expect(),
            key = token.string || token.text;
            this.consume(':');
            var value = this.expression();
            keyValues.push({key: key, value: value});
            if (!value.constant) {
              allConstant = false;
            }
          } while (this.expect(','));
        }
        this.consume('}');

        return extend(function(self, locals) {
          var object = {};
          for (var i = 0; i < keyValues.length; i++) {
            var keyValue = keyValues[i];
            object[keyValue.key] = keyValue.value(self, locals);
          }
          return object;
        }, {
          literal: true,
          constant: allConstant
        });
      }
    };


    //////////////////////////////////////////////////
    // Parser helper functions
    //////////////////////////////////////////////////

    function setter(obj, path, setValue, fullExp) {
      var element = path.split('.'), key;
      for (var i = 0; element.length > 1; i++) {
        key = ensureSafeMemberName(element.shift(), fullExp);
        var propertyObj = obj[key];
        if (!propertyObj) {
          propertyObj = {};
          obj[key] = propertyObj;
        }
        obj = propertyObj;
      }
      key = ensureSafeMemberName(element.shift(), fullExp);
      obj[key] = setValue;
      return setValue;
    }

    var getterFnCache = {};

    /**
     * Implementation of the "Black Hole" variant from:
     * - http://jsperf.com/angularjs-parse-getter/4
     * - http://jsperf.com/path-evaluation-simplified/7
     */
    function cspSafeGetterFn(key0, key1, key2, key3, key4, fullExp) {
      ensureSafeMemberName(key0, fullExp);
      ensureSafeMemberName(key1, fullExp);
      ensureSafeMemberName(key2, fullExp);
      ensureSafeMemberName(key3, fullExp);
      ensureSafeMemberName(key4, fullExp);

      return function cspSafeGetter(scope, locals) {
              var pathVal = (locals && locals.hasOwnProperty(key0)) ? locals : scope;

              if (pathVal == null) return pathVal;
              pathVal = pathVal[key0];

              if (!key1) return pathVal;
              if (pathVal == null) return undefined;
              pathVal = pathVal[key1];

              if (!key2) return pathVal;
              if (pathVal == null) return undefined;
              pathVal = pathVal[key2];

              if (!key3) return pathVal;
              if (pathVal == null) return undefined;
              pathVal = pathVal[key3];

              if (!key4) return pathVal;
              if (pathVal == null) return undefined;
              pathVal = pathVal[key4];

              return pathVal;
            };
    }

    function simpleGetterFn1(key0, fullExp) {
      ensureSafeMemberName(key0, fullExp);

      return function simpleGetterFn1(scope, locals) {
        if (scope == null) return undefined;
        return ((locals && locals.hasOwnProperty(key0)) ? locals : scope)[key0];
      };
    }

    function simpleGetterFn2(key0, key1, fullExp) {
      ensureSafeMemberName(key0, fullExp);
      ensureSafeMemberName(key1, fullExp);

      return function simpleGetterFn2(scope, locals) {
        if (scope == null) return undefined;
        scope = ((locals && locals.hasOwnProperty(key0)) ? locals : scope)[key0];
        return scope == null ? undefined : scope[key1];
      };
    }

    function getterFn(path, options, fullExp) {
      // Check whether the cache has this getter already.
      // We can use hasOwnProperty directly on the cache because we ensure,
      // see below, that the cache never stores a path called 'hasOwnProperty'
      if (getterFnCache.hasOwnProperty(path)) {
        return getterFnCache[path];
      }

      var pathKeys = path.split('.'),
          pathKeysLength = pathKeys.length,
          fn;

      // When we have only 1 or 2 tokens, use optimized special case closures.
      // http://jsperf.com/angularjs-parse-getter/6
      if (pathKeysLength === 1) {
        fn = simpleGetterFn1(pathKeys[0], fullExp);
      } else if (pathKeysLength === 2) {
        fn = simpleGetterFn2(pathKeys[0], pathKeys[1], fullExp);
      } else if (options.csp) {
        if (pathKeysLength < 6) {
          fn = cspSafeGetterFn(pathKeys[0], pathKeys[1], pathKeys[2], pathKeys[3], pathKeys[4], fullExp,
                              options);
        } else {
          fn = function(scope, locals) {
            var i = 0, val;
            do {
              val = cspSafeGetterFn(pathKeys[i++], pathKeys[i++], pathKeys[i++], pathKeys[i++],
                                    pathKeys[i++], fullExp, options)(scope, locals);

              locals = undefined; // clear after first iteration
              scope = val;
            } while (i < pathKeysLength);
            return val;
          };
        }
      } else {
        var code = 'var p;\n';
        forEach(pathKeys, function(key, index) {
          ensureSafeMemberName(key, fullExp);
          code += 'if(s == null) return undefined;\n' +
                  's='+ (index
                          // we simply dereference 's' on any .dot notation
                          ? 's'
                          // but if we are first then we check locals first, and if so read it first
                          : '((k&&k.hasOwnProperty("' + key + '"))?k:s)') + '["' + key + '"]' + ';\n';
        });
        code += 'return s;';

        /* jshint -W054 */
        var evaledFnGetter = new Function('s', 'k', 'pw', code); // s=scope, k=locals, pw=promiseWarning
        /* jshint +W054 */
        evaledFnGetter.toString = valueFn(code);
        fn = evaledFnGetter;
      }

      // Only cache the value if it's not going to mess up the cache object
      // This is more performant that using Object.prototype.hasOwnProperty.call
      if (path !== 'hasOwnProperty') {
        getterFnCache[path] = fn;
      }
      return fn;
    }



    var filters = {},
        lexer = new Lexer({}),
        parser = new Parser(lexer, getFilter);

    /**
     * Compiles src and returns a function that executes src on a target object.
     * The compiled function is cached under compile.cache[src] to speed up further calls.
     *
     * @param {string} src
     * @returns {function}
     */
    function compile(src) {
        var cached;

        if (typeof src !== "string") {
            throw new TypeError("src must be a string, instead saw '" + typeof src + "'");
        }

        if (!compile.cache) {
            return parser.parse(src);
        }

        cached = compile.cache[src];
        if (!cached) {
            cached = compile.cache[src] = parser.parse(src);
        }

        return cached;
    }

    /**
     * A cache containing all compiled functions. The src is used as key.
     * Set this on false to disable the cache.
     *
     * @type {object}
     */
    compile.cache = {};

    /**
     * Just a stub of angular's $filter-method
     *
     * @private
     * @param {string} name
     * @returns {function}
     */
    function getFilter(name) {
        return filters[name];
    }

})();