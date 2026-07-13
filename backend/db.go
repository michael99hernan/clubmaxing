package main

import (
	"context"
	"log"
	"os"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pool is the raw connection pool.
// queries wraps that pool with the sqlc-generated, typed functions.
var pool *pgxpool.Pool
var queries *sqlcdb.Queries

func connectDB() {
	// DATABASE_URL is what Railway (and most Postgres hosts) inject
	// automatically. Falls back to the old hardcoded local Docker
	// connection string so `go run .` still works unchanged for local dev.
	connString := os.Getenv("DATABASE_URL")
	if connString == "" {
		connString = "postgres://postgres:devpass@localhost:5432/clubmax"
	}

	p, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		log.Fatalf("unable to create connection pool: %v", err)
	}

	// Ping forces an actual round-trip to Postgres right now,
	// so we fail fast at startup instead of on the first real request.
	err = p.Ping(context.Background())
	if err != nil {
		log.Fatalf("unable to reach database: %v", err)
	}

	pool = p
	queries = sqlcdb.New(pool)
	log.Println("connected to database")
}
