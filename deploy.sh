ssh server -T <<'EOL'
	cd conrad && \
	git fetch && git reset --hard origin/main && \
	docker compose up --build -d
EOL