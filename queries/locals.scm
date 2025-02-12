(jinja_for
  left: [
    (identifier) @local.definition
    (pattern_list
      (identifier) @local.definition)
  ]
  body: (_) @local.scope)

(jinja_macro
  name: (identifier) @name
  parameters: (parameters [
    (identifier) @local.definition
    (default_parameter
      name: (identifier) @local.definition)
  ])
  body: (_) @local.scope) @definition.function

(jinja_with
  (assignment left: (identifier) @local.definition)
  body: (_) @local.scope)

(jinja_assign
  left: (identifier) @local.definition)
(jinja_assign_block
  left: (identifier) @local.definition)
(assignment
  left: (identifier) @local.definition)

(identifier) @local.reference
