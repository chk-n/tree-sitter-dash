; Function calls

(call_expression
  name: (identifier) @function)

(call_expression
  name: (identifier) @function.builtin
  (#match? @function.builtin "^(make|len|cap|size)$"))

; Function definitions

(function_statement
  name: (identifier) @function)

(function_literal) @function

; Types

(primitive_type) @type.builtin
(memory_type) @type.builtin
(type_identifier) @type

; Identifiers
; BUG: enabling this causes functions to not match anymore
; (identifier) @variable

; Operators

[
  "--"
  "-"
  "="
  "!"
  "!="
  "*"
  "/"
  "&"
  "&&"
  "||"
  "%"
  "^"
  "+"
  "++"
  "<"
  "<="
  "="
  "=="
  ">"
  ">="
  "?"
  "??"
] @operator

; Keywords

[
  "type"
  "alias"
  "pub"
  "use"
] @keyword

[
  "if"  
  "else"
  "match"
  "case"
] @keyword.control.conditional

[
  "for"
] @keyword.control.repeat

[
  "lib"
] @keyword.control.import

[
  "return"
  (next_keyword)
  (break_keyword)
] @keyword.control.return

[
  "fn"
] @keyword.function

[
  "var"
  "let"
  "gen"
  "struct"
  "enum"
  "union"
] @keyword.storage.type

[
  "defer"
  ; "goto"
] @function.macro

; Delimiters

[
  ":"
  "."
  ","
] @punctuation.delimiter

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

; Literals

[
  (int_literal)
] @constant.numeric.integer

[
  (float_literal)
] @constant.numeric.float

[
  (string_literal)
  (multi_string_literal)
  (char_literal)
] @string

[
  (true)
  (false)
] @constant.builtin.boolean

[
  (null)
] @constant.builtin


(comment) @comment
