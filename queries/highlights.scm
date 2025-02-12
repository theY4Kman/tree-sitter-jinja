;;;;
;; Jinja

[
  "for"
  "in"
  "if"
  "else"
  "is"
] @keyword

(_ (block_begin) (tag_name) @function)

(block_begin) @tag
(block_end) @tag
(variable_begin) @tag
(variable_end) @tag

(jinja_for recursive: _ @keyword)


;;;;
;; Python

; Identifier naming conventions

((identifier) @constructor
 (#match? @constructor "^[A-Z]"))

((identifier) @constant
 (#match? @constant "^[A-Z][A-Z_]*$"))

; Function calls

(call
  function: (identifier) @function)
(call
  function: (attribute attribute: (identifier) @function.method))

; Function definitions

(jinja_macro
  name: (identifier) @function)

(identifier) @variable
(attribute attribute: (identifier) @property)

; Literals

[
  (none)
  (true)
  (false)
] @constant.builtin

[
  (integer)
  (float)
] @number

(comment) @comment
(string) @string
(escape_sequence) @escape

[
  "-"
  "!="
  "*"
  "**"
  "/"
  "//"
  "&"
  "%"
  "^"
  "+"
  "<"
  "<<"
  "<="
  "<>"
  "="
  ">"
  ">="
  ">>"
  "|"
  "~"
  "and"
  "in"
  "is"
  "not"
  "or"
  "not in"
  "is not"
] @operator
