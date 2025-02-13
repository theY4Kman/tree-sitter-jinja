#include <stdio.h>
#include <tree_sitter/parser.h>

enum TokenType {
	BLOCK_BEGIN,
	BLOCK_END,
	VARIABLE_BEGIN,
	VARIABLE_END,
	COMMENT_BEGIN,
	COMMENT_END,
	TEMPLATE_DATA,
};

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }


bool tree_sitter_jinja_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
	bool in_error_recovery = (
        valid_symbols[BLOCK_BEGIN] &&
        valid_symbols[BLOCK_END] &&
        valid_symbols[VARIABLE_BEGIN] &&
        valid_symbols[VARIABLE_END] &&
        valid_symbols[COMMENT_BEGIN] &&
        valid_symbols[COMMENT_END] &&
        valid_symbols[TEMPLATE_DATA]
    );

	bool in_tag = valid_symbols[BLOCK_END];
	bool in_variable = valid_symbols[VARIABLE_END];
	bool in_comment = valid_symbols[COMMENT_END];
	bool in_template = !in_error_recovery && valid_symbols[TEMPLATE_DATA];
	bool expect_openings = valid_symbols[BLOCK_BEGIN] && valid_symbols[VARIABLE_BEGIN] && valid_symbols[COMMENT_BEGIN];

	if (!lexer->lookahead) {
		return false;
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

	// Eat insignificant whitespace before dealing with Jinja delimiters
	while (!lexer->eof(lexer)) {
		if (lexer->lookahead == ' '
			|| lexer->lookahead == '\t'
			|| lexer->lookahead == '\r'
			|| lexer->lookahead == '\n'
		) {
			skip(lexer);
		} else {
			break;
		}
	}

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
			if (lexer->lookahead == '-') {
				advance(lexer);
			}

			return true;
		}

		return false;
	}

	if (in_tag || in_variable || in_comment) {
		if (lexer->lookahead == '-') {
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


void * tree_sitter_jinja_external_scanner_create() { return NULL; }
void tree_sitter_jinja_external_scanner_destroy(void *payload) {}
unsigned tree_sitter_jinja_external_scanner_serialize(void *payload, char *buffer) { return 0; }
void tree_sitter_jinja_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}
