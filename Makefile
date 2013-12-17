test:
	NODE_ENV=test ./node_modules/.bin/mocha test/unit test/requests

.PHONY: test