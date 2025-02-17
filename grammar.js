const PREC = {
  // this resolves a conflict between the usage of ':' in a lambda vs in a
  // typed parameter. In the case of a lambda, we don't allow typed parameters.
  lambda: -2,
  typed_parameter: -1,
  conditional: -1,

  parenthesized_expression: 1,
  parenthesized_list_splat: 1,
  or: 10,
  and: 11,
  not: 12,
  compare: 13,
  bitwise_and: 14,
  xor: 15,
  shift: 16,
  plus: 17,
  times: 18,
  unary: 19,
  power: 20,
  call: 21,
};

const binaryOpTable = [
  [prec.left, '+', PREC.plus],
  [prec.left, '-', PREC.plus],
  [prec.left, '~', PREC.plus],
  [prec.left, '*', PREC.times],
  [prec.left, '@', PREC.times],
  [prec.left, '/', PREC.times],
  [prec.left, '%', PREC.times],
  [prec.left, '//', PREC.times],
  [prec.right, '**', PREC.power],
  [prec.left, '&', PREC.bitwise_and],
  [prec.left, '^', PREC.xor],
  [prec.left, '<<', PREC.shift],
  [prec.left, '>>', PREC.shift],
];

module.exports = grammar({
  name: 'jinja',

  conflicts: $ => [
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.list_splat_pattern],
    [$.tuple, $.tuple_pattern],
    [$.list, $.list_pattern],
    [$.missing_binary_operator, $.binary_operator],
  ],

  supertypes: $ => [
    $.expression,
    $.primary_expression,
    $.pattern,
    $.parameter,
  ],

  externals: $ => [
    $.block_begin,
    $.block_end,
    $.variable_begin,
    $.variable_end,
    $.comment_begin,
    $.comment_end,
    $._jinja_raw_body,
    $._string_delimiter,
    $.string_data,
    $.escape_sequence,
    $.template_data,
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => optional($._body),
    _body: $ => repeat1($._statement),
    _statement: $ => choice(
      $.jinja_raw,

      $.jinja_assign,
      $.jinja_assign_block,
      $.jinja_with,

      $.jinja_expr_stmt,

      $.jinja_macro,
      $.jinja_call_block,
      $.jinja_filter_block,

      $.jinja_if,

      $.jinja_for,
      $.jinja_break,
      $.jinja_continue,

      // Rewst extensions
      $.jinja_try,

      // $.jinja_import,
      // $.jinja_from_import,

      // $.jinja_block,
      // $.jinja_extends,
      // $.jinja_include,

      // Arbitrary jinja tags
      $.jinja_tag,

      $.jinja_variable,
      $.template_data,
      $.comment,
    ),

    jinja_raw: $ => seq(
      simpleTag($, 'raw'),
      field('body', alias($._jinja_raw_body, $.template_data)),
      simpleTag($, 'endraw'),
    ),
    _jinja_raw_body: $ => /.+/,

    jinja_assign: $ => seq(
      $.block_begin,
      tagName($, 'set'),
      field('left', $.identifier),
      '=',
      field('right', $.expression),
      $.block_end,
    ),

    jinja_assign_block: $ => seq(
      $.block_begin,
      tagName($, 'set'),
      field('left', $.identifier),
      $.block_end,
      field('right', optional($._body)),
      simpleTag($, 'endset'),
    ),

    jinja_with: $ => seq(
      $.block_begin,
      tagName($, 'with'),
      optional($._assignments),
      $.block_end,
      field('body', optional($._body)),
      simpleTag($, 'endwith'),
    ),

    jinja_call_block: $ => seq(
      $.block_begin,
      tagName($, 'call'),
      field('parameters', optional(alias($._jinja_call_parameters, $.parameters))),
      field('call', $.call),
      $.block_end,
      field('body', optional($._body)),
      simpleTag($, 'endcall'),
    ),

    _jinja_call_parameters: $ => seq(
      token.immediate('('),
      optional($._parameters),
      ')',
    ),

    jinja_expr_stmt: $ => seq(
      $.block_begin,
      tagName($, 'do'),
      field('expression', $.expression),
      $.block_end,
    ),

    jinja_filter_block: $ => seq(
      $.block_begin,
      tagName($, 'filter'),
      $.filter_call,
      $.block_end,
      field('body', optional($._body)),
      simpleTag($, 'endfilter'),
    ),

    jinja_for: $ => seq(
      $.block_begin,
      tagName($, 'for'),
      field('left', $._left_hand_side),
      'in',
      field('right', commaSep1($.expression)),
      optional(','),
      field('if', optional($.if_clause)),
      field('recursive', optional('recursive')),
      $.block_end,
      field('body', optional($._body)),
      field('else', optional($.jinja_else_clause)),
      simpleTag($, 'endfor'),
    ),
    jinja_break: $ => simpleTag($, 'break'),
    jinja_continue: $ => simpleTag($, 'continue'),

    jinja_if: $ => seq(
      $.block_begin,
      tagName($, 'if'),
      field('condition', $.expression),
      $.block_end,
      field('body', optional($._body)),
      field('elif', repeat($.jinja_elif_clause)),
      field('else', optional($.jinja_else_clause)),
      simpleTag($, 'endif'),
    ),

    jinja_macro: $ => seq(
      $.block_begin,
      tagName($, 'macro'),
      field('name', $.identifier),
      field('parameters', $.parameters),
      $.block_end,
      field('body', optional($._body)),
      simpleTag($, 'endmacro'),
    ),

    jinja_try: $ => seq(
      $.block_begin,
      tagName($, 'try'),
      $.block_end,
      field('body', optional($._body)),
      field('catch', optional($.jinja_catch_clause)),
      simpleTag($, 'endtry'),
    ),

    jinja_tag: $ => prec(-100, seq(
      $.block_begin,
      field('name', $.identifier),
      $.block_end,
    )),

    filter_call: $ => prec.left(seq(
      field('filter', $.identifier),
      field('arguments', optional(choice(
        $.generator_expression,
        $.argument_list,
      ))))),

    jinja_catch_clause: $ => prec.left(seq(
      simpleTag($, 'catch'),
      field('body', optional($._body)),
    )),

    jinja_elif_clause: $ => prec.left(seq(
      $.block_begin,
      tagName($, 'elif'),
      field('condition', $.expression),
      field('body', optional($._body)),
    )),

    jinja_else_clause: $ => prec.left(seq(
      simpleTag($, 'else'),
      field('body', optional($._body)),
    )),

    jinja_variable: $ => seq(
      $.variable_begin,
      $.expression,
      $.variable_end,
    ),

    parameters: $ => seq(
      '(',
      optional($._parameters),
      ')'
    ),

    list_splat: $ => seq(
      '*',
      $.expression,
    ),

    dictionary_splat: $ => seq(
      '**',
      $.expression
    ),

    parenthesized_list_splat: $ => prec(PREC.parenthesized_list_splat, seq(
      '(',
      choice(
        alias($.parenthesized_list_splat, $.parenthesized_expression),
        $.list_splat,
      ),
      ')',
    )),

    argument_list: $ => seq(
      '(',
      optional(commaSep1(
        choice(
          $.expression,
          $.list_splat,
          $.dictionary_splat,
          alias($.parenthesized_list_splat, $.parenthesized_expression),
          $.keyword_argument
        )
      )),
      optional(','),
      ')'
    ),

    _parameters: $ => seq(
      commaSep1($.parameter),
      optional(',')
    ),

    _assignments: $ => seq(
      commaSep1($.assignment),
      optional(',')
    ),

    _patterns: $ => seq(
      commaSep1($.pattern),
      optional(',')
    ),

    parameter: $ => choice(
      $.identifier,
      $.default_parameter,
    ),

    assignment: $ => seq(
      field('left', $.identifier),
      '=',
      field('right', $.expression)
    ),

    pattern: $ => choice(
      $.identifier,
      $.subscript,
      $.attribute,
      $.list_splat_pattern,
      $.tuple_pattern,
      $.list_pattern
    ),

    tuple_pattern: $ => seq(
      '(',
      optional($._patterns),
      ')'
    ),

    list_pattern: $ => seq(
      '[',
      optional($._patterns),
      ']'
    ),

    default_parameter: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $.expression)
    ),

    list_splat_pattern: $ => seq(
      '*',
      choice($.identifier, $.subscript, $.attribute)
    ),

    expression: $ => choice(
      $.comparison_operator,
      $.not_operator,
      $.boolean_operator,
      $.primary_expression,
      $.conditional_expression,
    ),
    primary_expression: $ => choice(
      $.binary_operator,
      $.identifier,
      $.string,
      $.concatenated_string,
      $.integer,
      $.float,
      $.true,
      $.false,
      $.none,
      $.unary_operator,
      $.filter_expr,
      $.attribute,
      $.subscript,
      $.call,
      $.list,
      $.list_comprehension,
      $.dictionary,
      $.dictionary_comprehension,
      $.set,
      $.set_comprehension,
      $.tuple,
      $.parenthesized_expression,
      $.generator_expression,
    ),

    not_operator: $ => prec(PREC.not, seq(
      'not',
      field('argument', $.expression)
    )),

    boolean_operator: $ => choice(
      prec.left(PREC.and, seq(
        field('left', $.expression),
        field('operator', 'and'),
        field('right', $.expression)
      )),
      prec.left(PREC.or, seq(
        field('left', $.expression),
        field('operator', 'or'),
        field('right', $.expression)
      ))
    ),

    binary_operator: $ =>
      choice(...binaryOpTable.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $.primary_expression),
        field('operator', operator),
        field('right', $.primary_expression),
      )))),

    missing_binary_operator: $ => prec(
      -100,
      choice(...binaryOpTable.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $.primary_expression),
        field('operator', operator),
      ))))
    ),

    unary_operator: $ => prec(PREC.unary, seq(
      field('operator', choice('+', '-')),
      field('argument', $.primary_expression)
    )),

    filter_expr: $ => prec.left(prec(PREC.unary, seq(
      field('target', $.primary_expression),
      field('operator', '|'),
      $.filter_call,
    ))),

    comparison_operator: $ => prec.left(PREC.compare, seq(
      $.primary_expression,
      repeat1(seq(
        field('operators',
          choice(
            '<',
            '<=',
            '==',
            '!=',
            '>=',
            '>',
            '<>',
            'in',
            alias(seq('not', 'in'), 'not in'),
            'is',
            alias(seq('is', 'not'), 'is not')
          )),
        $.primary_expression
      ))
    )),

    _left_hand_side: $ => choice(
      $.pattern,
      $.pattern_list,
    ),

    pattern_list: $ => seq(
      $.pattern,
      choice(
        ',',
        seq(
          repeat1(seq(
            ',',
            $.pattern
          )),
          optional(',')
        )
      )
    ),

    attribute: $ => prec(PREC.call, seq(
      field('object', $.primary_expression),
      '.',
      field('attribute', $.identifier)
    )),

    subscript: $ => prec(PREC.call, seq(
      field('value', $.primary_expression),
      '[',
      commaSep1(field('subscript', choice($.expression, $.slice))),
      optional(','),
      ']'
    )),

    slice: $ => seq(
      optional($.expression),
      ':',
      optional($.expression),
      optional(seq(':', optional($.expression)))
    ),

    call: $ => prec(PREC.call, seq(
      field('function', $.primary_expression),
      field('arguments', choice(
        $.generator_expression,
        $.argument_list
      ))
    )),

    keyword_argument: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $.expression)
    ),

    // Literals

    list: $ => seq(
      '[',
      optional($._collection_elements),
      ']'
    ),

    set: $ => seq(
      '{',
      $._collection_elements,
      '}'
    ),

    tuple: $ => seq(
      '(',
      optional($._collection_elements),
      ')'
    ),

    dictionary: $ => seq(
      '{',
      optional(commaSep1(choice($.pair, $.dictionary_splat))),
      optional(','),
      '}'
    ),

    pair: $ => seq(
      field('key', $.expression),
      ':',
      field('value', $.expression)
    ),

    list_comprehension: $ => seq(
      '[',
      field('body', $.expression),
      $._comprehension_clauses,
      ']'
    ),

    dictionary_comprehension: $ => seq(
      '{',
      field('body', $.pair),
      $._comprehension_clauses,
      '}'
    ),

    set_comprehension: $ => seq(
      '{',
      field('body', $.expression),
      $._comprehension_clauses,
      '}'
    ),

    generator_expression: $ => seq(
      '(',
      field('body', $.expression),
      $._comprehension_clauses,
      ')'
    ),

    _comprehension_clauses: $ => seq(
      $.for_in_clause,
      repeat(choice(
        $.for_in_clause,
        $.if_clause
      ))
    ),

    parenthesized_expression: $ => prec(PREC.parenthesized_expression, seq(
      '(',
      $.expression,
      ')'
    )),

    _collection_elements: $ => seq(
      commaSep1(choice(
        $.expression, $.list_splat, $.parenthesized_list_splat
      )),
      optional(',')
    ),

    for_in_clause: $ => prec.left(seq(
      'for',
      field('left', $._left_hand_side),
      'in',
      field('right', commaSep1($.expression)),
      optional(',')
    )),

    if_clause: $ => seq(
      'if',
      $.expression
    ),

    _literal: $ => choice(
      $.string,
    ),

    string: $ => seq(
      $._string_delimiter,
      field('content', repeat(choice($.string_data, $.escape_sequence))),
      $._string_delimiter,
    ),
    string_data: $ => token.immediate(prec(1, /[^'"]+/)),
    escape_sequence: $ => token.immediate(prec(1, /\\(u[a-fA-F\d]{4}|U[a-fA-F\d]{8}|\d{3}|['"abfrntv\\]|N\{[^}]+})/)),

    concatenated_string: $ => seq(
      $.string,
      repeat1($.string)
    ),

    conditional_expression: $ => prec.right(PREC.conditional, seq(
      $.expression,
      'if',
      $.expression,
      'else',
      $.expression
    )),

    integer: $ => token(choice(
      seq(
        choice('0x', '0X'),
        repeat1(/_?[A-Fa-f0-9]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0o', '0O'),
        repeat1(/_?[0-7]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0b', '0B'),
        repeat1(/_?[0-1]+/),
        optional(/[Ll]/)
      ),
      seq(
        repeat1(/[0-9]+_?/),
        choice(
          optional(/[Ll]/), // long numbers
          optional(/[jJ]/) // complex numbers
        )
      )
    )),

    float: $ => {
      const digits = repeat1(/[0-9]+_?/);
      const exponent = seq(/[eE][+-]?/, digits)

      return token(seq(
        choice(
          seq(digits, '.', optional(digits), optional(exponent)),
          seq(optional(digits), '.', digits, optional(exponent)),
          seq(digits, exponent),
        ),
        optional(choice(/[Ll]/, /[jJ]/)),
      ))
    },

    identifier: $ => /[_\p{XID_Start}][_\p{XID_Continue}]*/,

    true: $ => choice('True', 'true'),
    false: $ => choice('False', 'false'),
    none: $ => choice('None', 'none'),

    comment: $ => seq(
      $.comment_begin,
      /([^#]+|#[^}])*/,
      $.comment_end,
    ),

    template_data: $ => /([^{}]+|\{[^%{#]|[%}#][^}])+/,

    block_begin: $ => /\{%-?/,
    block_end: $ => /-?%}/,
    variable_begin: $ => /\{\{-?/,
    variable_end: $ => /-?}}/,
    comment_begin: $ => /\{#-?/,
    comment_end: $ => /-?#}/,

    _string_delimiter: $ => /'''|"""|'|"/,
  },
});

function commaSep1(rule) {
  return sep1(rule, ',')
}

function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)))
}

function simpleTag($, name) {
  return seq(
    $.block_begin,
    tagName($, name),
    $.block_end,
  )
}

function tagName($, name) {
  return alias(token(name), $.tag_name);
}
