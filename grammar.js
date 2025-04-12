/// <reference types="tree-sitter-cli/dsl" />
// @ts-check
const newline = /\n/;
const terminator = choice(newline, '\0');

const PREC = {
  primary: 9,  
  paren: 8,
  postfix: 7,
  prefix: 6,
  null_coalesce: 5,
  multiplicative: 4,
  additive: 3,
  comparative: 2,
  and: 1,
  or: 0,
  composite_literal: -1  
};
const decimal_digit = /[0-9]/;
const decimal_digits = seq(decimal_digit, repeat(seq(optional('_'), decimal_digit)));

const int_literal = choice('0', seq(/[1-9]/, optional(seq(optional('_'), decimal_digits))));
const float_literal = choice(
  seq(decimal_digits, '.', optional(decimal_digits)),
);

module.exports = grammar({
  name: 'dash',

  extras: $ => [
    /\s/,
    $.comment
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => seq(
      // NOTE: consider allowing partial statements and expressions
      // to allow parsing of code snippets in documentation
      $.library_statement,
      repeat($._top_level_statement)
    ),

    library_statement: $ => seq(
      'lib',
      $.identifier
    ),

    _top_level_statement: $ => choice(
      $.function_statement,
      $.struct_statement,
      $.enum_statement,
      $.type_statement,
      $.type_alias_statement,
      $.union_statement,
      $.assignment_statement
    ),
    
    // ----- //
    // Types //
    // ----- //
    
    _type: $ => choice(
      $.primitive_type,
      $.array_type,
      $.pointer_type,
      $.optional_type,
      $.function_type,
      $.memory_type,
      $._type_identifier,
      $.dot_type
    ),

    primitive_type: $ => choice(
      'i8', 'i16', 'i32', 'i64', 'i128',
      'u8', 'u16', 'u32', 'u64', 'u128',
      'f32', 'f64',
      'bool', 'string', 
      'byte', 'char'
    ),

    array_type: $ => choice(
      seq('[', ']', $._type),
      seq(
        '[', 
        field("length",$._expression), 
        ']', 
        $._type
      )
    ),

    pointer_type: $ => prec(PREC.prefix, 
      seq('*', $._type)
    ),

    optional_type: $ => prec(PREC.prefix,
      seq('?', $._type)
    ),

    function_type: $ => prec.right(1,seq(
      'fn',
      field('parameters', $.type_parameter_list),
      field('error_prone', optional($.error_prone)),
      field('result', optional($._function_return_type))
    )),

    memory_type: $ => seq(
      'memory',
      '<',
      field("type", $._type),
      '>'
    ),

    _function_return_type: $ => choice(
      $._type,
      $.multi_return_type
    ),

    multi_return_type: $ => 
       prec.right(1, seq(
          $._type,
          repeat1(seq(',', $._type))
    )),

    dot_type: $ => prec(PREC.primary, seq(
      field('left', $.identifier),
      '.',
      field('right', $._type_identifier)
    )),

    // ----------- //
    // Expressions //
    // ----------- //
    
    _expression: $ => choice(
      $.identifier,
      $.int_literal,
      $.float_literal,
      $.string_literal,
      $.multi_string_literal,
      $.char_literal,
      $.true,
      $.false,
      $.null,
      $.call_expression,
      $.group_expression,
      $.prefix_expression,
      $.infix_expression,
      $.postfix_expression,
      $.index_expression,
      $.slice_expression,
      $.dot_expression,
      $.use_expression,
      $.copy_expression,
      $.array_literal,
      $.struct_literal,
      $.function_literal,
    ),

    copy_expression: $ => prec.right(1, choice(
      seq(
        field("name", $.identifier), 
        '^'
      ),
      seq(
        field("name", $.identifier), 
        '^', 
        field("body", $.block_statement),
      ),
    )),

     group_expression: $ => prec(PREC.paren, seq(
      '(',
      $._expression,
      ')'
    )),

    prefix_expression: $ => prec(PREC.prefix, choice(
      seq('-', $._expression),
      seq('!', $._expression),
      seq('&', $._expression),
      seq('*', $._expression),
    )),

    postfix_expression: $ =>  prec(PREC.postfix, choice(
      seq($._expression, '++'),
      seq($._expression, '--'),
    )),

    error_prone: $ => token.immediate('!'),

    infix_expression: $ => choice(
      ...[
        ['*', PREC.multiplicative],
        ['/', PREC.multiplicative],
        ['%', PREC.multiplicative],
        ['+', PREC.additive],
        ['-', PREC.additive],
        ['<', PREC.comparative],
        ['<=', PREC.comparative],
        ['>', PREC.comparative],
        ['>=', PREC.comparative],
        ['==', PREC.comparative],
        ['!=', PREC.comparative],
        ['&&', PREC.and],
        ['||', PREC.or],
        ['??', PREC.null_coalesce],
        ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field("left", $._expression),
          field("operator", operator),
          field("right", $._expression),
        ))
      )
    ),
    
   if_expression: $ => prec.right(seq(
      'if',
      field("condition", $._expression),
      field("body", $._if_expression_block),
      optional(seq(
        'else',
        field("alternative", choice($.if_expression, $._if_expression_block))
      ))
    )),
    _if_expression_block: $ => prec.right(seq(
      '{',
      optional(repeat($._statement)),
      $._expression,
      '}',
    )),
 

    match_expression: $ => prec.right(seq(
      'match',
      field("scrutinee", $._expression),
      '{',
      repeat($.match_expression_case),
      optional($.match_expression_default),
      '}'
    )),
    match_expression_case: $ => seq(
      'case',
      field("condition", $._expression),
      ':',
      field("body", $._match_expression_block),
    ),
    match_expression_default: $ => seq(
      'case',
      '_',
      ':',
      field("body", $._match_expression_block),
    ),
    _match_expression_block: $ => seq(
      optional(repeat($._statement)),
      $._expression,
     ),
    
    assignable_expression_list: $ => prec.right(seq(
      $._assignable_expression,
      optional(seq(',', $._assignable_expression))
    )),
    
     _assignable_expression: $ => prec.right(choice(
        $._expression,
        $.if_expression,
        $.match_expression,
    )),

    call_expression: $ => prec(PREC.primary, choice(
      seq(
        field("name", alias('make', $.identifier)),
        field("arguments",$.special_argument_list)
      ),      
      seq(
      field("name", $.identifier),
      '(',
      optional(
        field("arguments",seq(
        sepBy(',', $._expression),
        optional(',')
      ))),
      ')'
    ))),
    special_argument_list: $ => seq(
      '(',
      optional(seq(
        $._type,
        repeat(seq(',', $._expression)),
        optional(',')
      )),
      ')'
    ),

    index_expression: $ =>  prec(PREC.primary,seq(
      field('operand', $._expression),
      '[',
      field('index', $._expression),
      ']'
    )),

    slice_expression: $ =>  prec(PREC.primary, seq(
      field('operand', $._expression),
      '[',
      choice(
        seq(
          optional(field('start', $._expression)),
          ':',
          field('end', $._expression),
        ),     
        seq(
          field('start', $._expression),
          ':',
          optional(field('end', $._expression)),
        )
      ),
      ']'
    )),

    dot_expression: $ => prec(PREC.primary, seq(
      field('operand', $._expression),
      '.',
      field('field', choice($.identifier, /\d+/))
    )),
    
    use_expression: $ => seq(
      "use",
      field("name", $.identifier),
      field("body", $.block_statement)
    ),

    // -------- //
    // Literals //
    // -------- //
    int_literal: $ => token(int_literal),
    float_literal: $ => token(float_literal),
    string_literal: $ => token(seq(
      '"',
      repeat(/[^"\n\r]/),
      '"'
    )),
    multi_string_literal: $ => token(seq(
      '`',
      repeat(/[^`]/),
      '`'
    )),
    char_literal: $ => token(choice(
      // Simple characters
      seq("'", /[^'\\]/, "'"),
  
      // Escaped characters
      seq("'", '\\', /[abtnr'"]/, "'"),
      seq("'", '\\', '\\', "'"),
  
      // Unicode characters
      seq("'", '\\u', /[0-9a-fA-F]{2}/, "'"),
      seq("'", '\\u', /[0-9a-fA-F]{4}/, "'"),
      seq("'", '\\u', /[0-9a-fA-F]{8}/, "'")
    )),
    function_literal: $ => prec.right(1, seq(
      'fn',
      field('parameters', $.parameter_list),
      field('result', optional($._function_return_type)),
      field('body', optional($.block_statement)),
    )),
    
    struct_literal: $ => prec.right(PREC.composite_literal, choice(
      $._struct_literal,
      $._struct_anonymous_literal,
    )),
    _struct_literal: $ =>  seq(
      field("name", $._type_identifier),
      token.immediate('{'),
      choice(
        seq(sepBy(',', $.struct_named_field), optional(',')),
        seq(sepBy(',', $.struct_unnamed_field), optional(','))
      ),
      '}'
    ),
    // NOTE: the precedence here is definitely too high
    // as tests pass i will leave as is. This will for
    // sure be a source of bugs in future.
    _struct_anonymous_literal: $ => prec(PREC.primary,seq(
      '{',   
       choice(
        seq(sepBy(',', $.struct_named_field), optional(',')),
        seq(sepBy(',', $.struct_unnamed_field), optional(','))
      ),
      '}'
    ),),
    struct_named_field: $ => seq(
      seq(
        field("key", $.identifier), 
        ":", 
        field("value",$._expression),
      ),
      ),
    struct_unnamed_field: $ => seq(
      field("value", $._expression),
    ),
     
    array_literal: $ => prec(PREC.composite_literal, seq(
      '[',
      optional(seq(
        sepBy(',', $._expression),
        optional(',')
      )),
      ']'
    )),

    // ---------- //
    // Statements //
    // ---------- //
    
    _statement: $ => choice(
      $.expression_statement,
      $.assignment_statement,
      $.return_statement,
      $.if_statement,
      $.for_statement,
      $.match_statement,
      $.block_statement,
      $.defer_statement,
      $.next_keyword,
      $.break_keyword,
    ),

    expression_statement: $ => prec.right(-1,$._expression),

    assignment_statement: $ => seq(
      field("left", $.decleration_list),
      '=',
      field("right", $.assignable_expression_list),
    ),

    decleration_list: $ => prec.right(1, seq(
       choice(
         $.let_statement,
         $.var_statement,
         $.identifier,
         $.dot_expression,
         $.index_expression,
         $.slice_expression,
       ),
      optional(seq(',',  choice(
         $.let_statement,
         $.var_statement,
         $.identifier,
         $.dot_expression,
         $.index_expression,
         $.slice_expression,
      ))),
    )),

    let_statement: $ => seq(
      'let',
      $.identifier
    ),

    var_statement: $ => seq(
      'var',
      $.identifier
    ),

    return_statement: $ => prec.right(1, seq(
      'return',
      optional(seq(
        $._expression,
        optional(seq(',', $._expression))
      ))
    )),

    if_statement: $ => prec.right(seq(
      'if',
      field("condition", $._expression),
      field("body", $.block_statement),
      optional(seq(
        'else',
        field("alternative", choice($.if_statement, $.block_statement))
      ))
    )),

    for_statement: $ => seq(
      'for',
      optional(choice(
          $.for_classic,
          $._expression
      )),
      field("body", $.block_statement)
    ),
    for_classic: $ =>  seq(
      field("initialiser", $.assignment_statement), ';', 
      field("condition", $._expression), ';', 
      field("update", choice($._expression, $.assignment_statement)),
    ),

    match_statement: $ => seq(
      'match',
      field("scrutinee", $._expression),
      '{',
      repeat($.match_statement_case),
      optional($.match_statement_default),
      '}'
    ),

    match_statement_case: $ => seq(
      'case',
      field("condition", $._expression),
      ':',
      optional(field("body", repeat($._statement)))
    ),

    match_statement_default: $ => seq(
      'case',
      '_',
      ':',
      optional(field("body", repeat($._statement)))
    ),

    block_statement: $ => seq(
      '{',
      repeat($._statement),
      '}'
    ),

    defer_statement: $ => seq(
      'defer',
      choice($.call_expression, $.block_statement)
    ),
    attribute_statement: $ => choice(
      $.function_attribute,
    ),

    function_statement: $ => prec.right(1, seq(
      repeat($.attribute_statement), 
      optional('pub'),
      'fn',
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      field('error_prone', optional($.error_prone)),
      field('result', optional($._function_return_type)),
      field('body', optional($.block_statement)),
    )),

    function_attribute: $ => choice(
      seq('@extern', '(', 'c', ')'),
      seq('@inline', '(', choice('never', 'hint', 'always'), ')')
    ),

    struct_statement: $ => seq(
      optional('pub'),
      optional('gen'),
      'struct',
      field("name",$.identifier),
      field("body", $.struct_body),
     ),

    struct_body: $ => seq(
      '{',
      optional(choice(
        seq(
          $.field_statement,
          repeat(seq(',', $.field_statement)),
        ),
        seq(
           newline,
           repeat(seq(
             $.field_statement,
             newline,
           ),
        )),
      )),
      '}'
    ),

    field_statement: $ => prec.right(1, seq(
      field("name", optional($.identifier)),
      field("type", $._type),
      optional(seq('|', $._expression))
    )),

    enum_statement: $ => seq(
      optional('pub'),
      'enum',
      field("name", $.identifier),
      field("body", $.enum_body)
    ),
    enum_body: $ => seq(   
      '{',
      newline,
      repeat(seq(
         $.field_statement,
         newline
      )),
      '}'
    ),
    
    type_statement: $ => seq(
      'type',
      field("name",$.identifier),
      field("type", $._type),
      optional(seq('|', $._expression))
    ),

    type_alias_statement: $ => seq(
      'alias',
      field("name", $.identifier),
      field("type", $._type)
    ),

    union_statement: $ => seq(
      optional('pub'),
      'union',
      field("name", $.identifier),
      field("body", $.union_body)
    ),
    union_body: $ => seq(
      '{',
      newline,
      repeat(seq(
         $._type,
         newline
      )),
      '}'
    ),

    // ------- //
    // Helpers //
    // ------- //
    
    type_parameter_list: $ => seq(
      '(',
      optional(seq(
        sepBy(',', $._type),
        optional(',')
      )),
      ')'
    ),
      
    parameter_list: $ => seq(
      '(',
      optional(seq(
        sepBy(',', $.parameter),
        optional(',')
      )),
      ')'
    ),

    parameter: $ => seq(
      field("name", $.identifier),
      optional(seq(',', $.identifier)),
      field("type",$._type)
    ),
       
    // keywords
    break_keyword: $ => 'break',
    next_keyword: $ => 'next',
    goto_keyword: $ => 'goto',
    
    // Terminals
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*'*/,
    _type_identifier: $ => alias($.identifier, $.type_identifier),
    true: $ => 'true',
    false: $ => 'false',
    null: $ => 'null', 
    comment: $ => token(choice(
      seq('//', /.*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')
    ))
  }
});

/**
 * Creates a rule to optionally match one or more instances of rule separated by sep
 */
function sepBy(sep, rule) {
  return optional(seq(rule, repeat(seq(sep, rule))));
}

