#include <stdio.h>
#include <string.h>
#include <tree_sitter/alloc.h>
#include <tree_sitter/parser.h>

enum TokenType {
	BLOCK_BEGIN,
	BLOCK_END,
	VARIABLE_BEGIN,
	VARIABLE_END,
	COMMENT_BEGIN,
	COMMENT_END,
	RAW_BODY,
	STRING_DELIMITER,
	STRING_DATA,
	ESCAPE_SEQUENCE,
	TEMPLATE_DATA,
};

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static void advance_whitespace(TSLexer *lexer, bool include) {
    void (*advance_func)(TSLexer *) = include ? advance : skip;

    while (lexer->lookahead != '\0') {
        if (lexer->lookahead == ' '
            || lexer->lookahead == '\t'
            || lexer->lookahead == '\r'
            || lexer->lookahead == '\n'
        ) {
            advance_func(lexer);
        } else {
            break;
        }
    }
}

static inline void eat_whitespace(TSLexer *lexer) { advance_whitespace(lexer, false); }

static inline void pass_whitespace(TSLexer *lexer) { advance_whitespace(lexer, true); }


typedef struct {
  // Null-terminated delimiter of the current string (i.e. ', ", ''', or """)
  char string_delimiter[4];
} JinjaScannerState;

void * tree_sitter_jinja_external_scanner_create() {
    return ts_calloc(sizeof(JinjaScannerState), 1);
}

void tree_sitter_jinja_external_scanner_destroy(void *payload) {
    if (payload == NULL) return;
    ts_free(payload);
}

unsigned tree_sitter_jinja_external_scanner_serialize(void *payload, char *buffer) {
    memcpy(buffer, payload, sizeof(JinjaScannerState));
    return sizeof(JinjaScannerState);
}

void tree_sitter_jinja_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    if (length != sizeof(JinjaScannerState)) {
        return;
    }
    memcpy(payload, buffer, sizeof(JinjaScannerState));
}

bool tree_sitter_jinja_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    JinjaScannerState *state = (JinjaScannerState *)payload;

	bool in_error_recovery = (
        valid_symbols[BLOCK_BEGIN] &&
        valid_symbols[BLOCK_END] &&
        valid_symbols[VARIABLE_BEGIN] &&
        valid_symbols[VARIABLE_END] &&
        valid_symbols[COMMENT_BEGIN] &&
        valid_symbols[COMMENT_END] &&
        valid_symbols[RAW_BODY] &&
        valid_symbols[STRING_DELIMITER] &&
        valid_symbols[STRING_DATA] &&
        valid_symbols[ESCAPE_SEQUENCE] &&
        valid_symbols[TEMPLATE_DATA]
    );

	bool in_tag = valid_symbols[BLOCK_END];
	bool in_variable = valid_symbols[VARIABLE_END];
	bool in_comment = valid_symbols[COMMENT_END];
	bool in_string = valid_symbols[STRING_DELIMITER] && valid_symbols[STRING_DATA] && valid_symbols[ESCAPE_SEQUENCE];
	bool in_template = !in_error_recovery && valid_symbols[TEMPLATE_DATA];
	bool expect_openings = valid_symbols[BLOCK_BEGIN] && valid_symbols[VARIABLE_BEGIN] && valid_symbols[COMMENT_BEGIN];

	if (!lexer->lookahead) {
		return false;
	}

	if (valid_symbols[STRING_DELIMITER]) {
	    if (!valid_symbols[STRING_DATA]) {
	        // Eat insignificant whitespace before opening delimiter
	        eat_whitespace(lexer);

            if (lexer->lookahead == '\'' || lexer->lookahead == '"') {
                char delim_char = lexer->lookahead;
                state->string_delimiter[0] = delim_char;
                advance(lexer);
                lexer->mark_end(lexer);

                if (lexer->lookahead == delim_char) {
                    // Handle triple quotes
                    state->string_delimiter[1] = delim_char;
                    advance(lexer);
                    if (lexer->lookahead == delim_char) {
                        state->string_delimiter[2] = delim_char;
                        advance(lexer);
                        state->string_delimiter[3] = '\0';
                        lexer->mark_end(lexer);
                    } else {
                        state->string_delimiter[1] = '\0';
                    }
                } else {
                    state->string_delimiter[1] = '\0';
                }

                lexer->result_symbol = STRING_DELIMITER;
                return true;
            }
        } else {
            // We are in a string, so we need to check if we are at the end
            if (lexer->lookahead == state->string_delimiter[0]) {
                advance(lexer);
                if (state->string_delimiter[1]) {
                    if (lexer->lookahead == state->string_delimiter[1]) {
                        advance(lexer);
                        if (lexer->lookahead == state->string_delimiter[2]) {
                            advance(lexer);
                            lexer->mark_end(lexer);
                            lexer->result_symbol = STRING_DELIMITER;
                            memset(state->string_delimiter, 0, sizeof(state->string_delimiter));
                            return true;
                        }
                    }
                } else {
                    lexer->mark_end(lexer);
                    lexer->result_symbol = STRING_DELIMITER;
                    memset(state->string_delimiter, 0, sizeof(state->string_delimiter));
                    return true;
                }
            }
        }
	}

	if (in_string) {
        bool is_string_data;
        if (lexer->lookahead == '\\') {
            lexer->result_symbol = ESCAPE_SEQUENCE;
            is_string_data = false;
        } else {
            lexer->result_symbol = STRING_DATA;
            is_string_data = true;
        }

	    while (lexer->lookahead) {
            lexer->mark_end(lexer);

            if (lexer->lookahead == '\\') {
                advance(lexer);

                if (lexer->lookahead == '\r' || lexer->lookahead == '\n') {
                    if (lexer->lookahead == '\r') {
                        advance(lexer);

                        if (lexer->lookahead == '\n') {
                            advance(lexer);
                        }
                    } else {
                        advance(lexer);
                    }

                    if (is_string_data) goto end_string;
                    lexer->mark_end(lexer);
                    lexer->result_symbol = ESCAPE_SEQUENCE;
                    return true;

                } else {
                    switch (lexer->lookahead) {
                        case 'a':
                        case 'b':
                        case 'f':
                        case 'n':
                        case 'r':
                        case 't':
                        case 'v':
                            if (is_string_data) goto end_string;

                            advance(lexer);
                            lexer->mark_end(lexer);
                            lexer->result_symbol = ESCAPE_SEQUENCE;
                            return true;

                        case 'u':
                        case 'U':
                        case 'x': {
                            int length;
                            if (lexer->lookahead == 'u') {
                                length = 4;
                            } else if (lexer->lookahead == 'U') {
                                length = 8;
                            } else {
                                length = 2;
                            }

                            advance(lexer);
                            for (int i = 0; i < length; i++) {
                                char const c = lexer->lookahead;
                                if (
                                    (c >= '0' && c <= '9')
                                    || (c >= 'a' && c <= 'f')
                                    || (c >= 'A' && c <= 'F')
                                ) {
                                    advance(lexer);
                                } else {
                                    if (is_string_data) goto end_string;

                                    lexer->mark_end(lexer);
                                    lexer->result_symbol = ESCAPE_SEQUENCE;
                                    return false;
                                }
                            }

                            if (is_string_data) goto end_string;

                            lexer->result_symbol = ESCAPE_SEQUENCE;
                            lexer->mark_end(lexer);
                            return true;
                        }

                        case 'N':
                            advance(lexer);
                            if (lexer->lookahead == '{') {
                                advance(lexer);

                                while (lexer->lookahead) {
                                    if (lexer->lookahead == '}') {
                                        advance(lexer);
                                        if (is_string_data) goto end_string;

                                        lexer->mark_end(lexer);
                                        lexer->result_symbol = ESCAPE_SEQUENCE;
                                        return true;
                                    } else if (lexer->lookahead == state->string_delimiter[0]) {
                                        if (is_string_data) goto end_string;

                                        lexer->mark_end(lexer);
                                        lexer->result_symbol = ESCAPE_SEQUENCE;
                                        return false;
                                    }

                                    advance(lexer);
                                }
                            }

                        case '"':
                        case '\'':
                            if (is_string_data) goto end_string;

                            advance(lexer);
                            lexer->mark_end(lexer);
                            lexer->result_symbol = ESCAPE_SEQUENCE;
                            return true;

                        default:
                            lexer->result_symbol = STRING_DATA;
                            break;
                    }

                    advance(lexer);
                    continue;

                end_string:
                    lexer->result_symbol = STRING_DATA;
                    return true;
                }

            } else if (lexer->lookahead == state->string_delimiter[0]) {
                advance(lexer);
                if (state->string_delimiter[1] && lexer->lookahead == state->string_delimiter[1]) {
                    advance(lexer);
                    if (state->string_delimiter[2] && lexer->lookahead == state->string_delimiter[2]) {
                        advance(lexer);
                    }
                }

                lexer->result_symbol = STRING_DATA;
                return true;
            }

            advance(lexer);
        }

        lexer->mark_end(lexer);
        lexer->result_symbol = STRING_DATA;
        return true;
	}

	// if we expect template data, we must eat all chars until we encounter a Jinja opening tag
	if (in_template && lexer->lookahead != '{') {
		while (lexer->lookahead) {
			if (lexer->lookahead == '{') {
				advance(lexer);

				if (lexer->lookahead == '{' || lexer->lookahead == '%' || lexer->lookahead == '#') {
					break;
				}
			}

			advance(lexer);
			lexer->mark_end(lexer);
		}

		lexer->result_symbol = TEMPLATE_DATA;
		return true;
	}

	if (valid_symbols[RAW_BODY]) {
	    while (lexer->lookahead) {
	        if (lexer->lookahead != '{') {
                advance(lexer);
                lexer->mark_end(lexer);
            } else {
                advance(lexer);
                if (lexer->lookahead != '%') continue;
                advance(lexer);
                if (lexer->lookahead == '+' || lexer->lookahead == '-') {
                    advance(lexer);
                }
                pass_whitespace(lexer);

                if (lexer->lookahead != 'e') continue;
                advance(lexer);
                if (lexer->lookahead != 'n') continue;
                advance(lexer);
                if (lexer->lookahead != 'd') continue;
                advance(lexer);
                if (lexer->lookahead != 'r') continue;
                advance(lexer);
                if (lexer->lookahead != 'a') continue;
                advance(lexer);
                if (lexer->lookahead != 'w') continue;
                advance(lexer);

                pass_whitespace(lexer);
                if (lexer->lookahead != '%') continue;
                advance(lexer);
                if (lexer->lookahead != '}') continue;
                advance(lexer);

                lexer->result_symbol = RAW_BODY;
                return true;
            }
	    }
	}

	// Eat insignificant whitespace before dealing with Jinja delimiters
	eat_whitespace(lexer);

	if (expect_openings) {
		if (lexer->lookahead != '{') {
			return false;
		}

		advance(lexer);
		if (lexer->lookahead == '{' || lexer->lookahead == '%' || lexer->lookahead == '#') {
			switch (lexer->lookahead) {
				case '{':
					lexer->result_symbol = VARIABLE_BEGIN;
					break;
				case '%':
					lexer->result_symbol = BLOCK_BEGIN;
					break;
				case '#':
					lexer->result_symbol = COMMENT_BEGIN;
					break;
			}

			advance(lexer);
			if (lexer->lookahead == '-' || lexer->lookahead == '+') {
				advance(lexer);
			}

			return true;
		}

		return false;
	}

	if (in_tag || in_variable || in_comment) {
		if (lexer->lookahead == '-' || lexer->lookahead == '+') {
			advance(lexer);
		}

        switch (lexer->lookahead) {
            case '}':
                if (!in_variable) return false;
                lexer->result_symbol = VARIABLE_END;
                break;
            case '%':
                if (!in_tag) return false;
                lexer->result_symbol = BLOCK_END;
                break;
            case '#':
                if (!in_comment) return false;
                lexer->result_symbol = COMMENT_END;
                break;
            default:
                return false;
        }

        advance(lexer);

        if (lexer->lookahead == '}') {
            advance(lexer);
            return true;
        }
	}

	return false;
}
