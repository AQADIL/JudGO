package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

type Problem struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Statement    string            `json:"statement"`
	InputFormat  string            `json:"inputFormat"`
	OutputFormat string            `json:"outputFormat"`
	Difficulty   string            `json:"difficulty"`
	Tags         []string          `json:"tags"`
	Status       string            `json:"status"`
	StarterCode  map[string]string `json:"starterCode"`
	TestCases    []TestCase        `json:"testCases"`
	CreatedAt    string            `json:"createdAt"`
	UpdatedAt    string            `json:"updatedAt"`
}

type TestCase struct {
	Input    string `json:"input"`
	Output   string `json:"output"`
	IsHidden bool   `json:"isHidden"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run scripts/import_problems.go <path_to_trans.json>")
		fmt.Println("Example: go run scripts/import_problems.go ./trans.json")
		os.Exit(1)
	}

	jsonPath := os.Args[1]

	// Load JSON
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		log.Fatalf("Failed to read JSON file: %v", err)
	}

	var problems []Problem
	if err := json.Unmarshal(data, &problems); err != nil {
		log.Fatalf("Failed to parse JSON: %v", err)
	}

	log.Printf("Loaded %d problems from %s", len(problems), jsonPath)

	// Init Firebase
	ctx := context.Background()

	dbURL := strings.TrimSpace(os.Getenv("FIREBASE_DB_URL"))
	if dbURL == "" {
		log.Fatal("FIREBASE_DB_URL is required")
	}

	serviceAccountPath := strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"))
	jsonCreds := strings.TrimSpace(os.Getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))

	var opt option.ClientOption
	if serviceAccountPath != "" {
		opt = option.WithCredentialsFile(serviceAccountPath)
	} else if jsonCreds != "" {
		opt = option.WithCredentialsJSON([]byte(jsonCreds))
	} else {
		log.Fatal("firebase credentials are not configured (set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON)")
	}

	config := &firebase.Config{DatabaseURL: dbURL}

	app, err := firebase.NewApp(ctx, config, opt)
	if err != nil {
		log.Fatalf("Failed to init Firebase app: %v", err)
	}

	client, err := app.Database(ctx)
	if err != nil {
		log.Fatalf("Failed to get DB client: %v", err)
	}

	// Import each problem
	problemsRef := client.NewRef("problems")

	imported := 0
	failed := 0

	for _, p := range problems {
		if p.ID == "" {
			log.Printf("Skipping problem without ID")
			continue
		}

		problemRef := problemsRef.Child(p.ID)

		// Convert to map for Firebase
		problemData := map[string]interface{}{
			"id":           p.ID,
			"title":        p.Title,
			"statement":    p.Statement,
			"inputFormat":  p.InputFormat,
			"outputFormat": p.OutputFormat,
			"difficulty":   p.Difficulty,
			"tags":         p.Tags,
			"status":       p.Status,
			"starterCode":  p.StarterCode,
			"testCases":    p.TestCases,
			"createdAt":    p.CreatedAt,
			"updatedAt":    p.UpdatedAt,
		}

		if err := problemRef.Set(ctx, problemData); err != nil {
			log.Printf("Failed to import %s: %v", p.ID, err)
			failed++
			continue
		}

		log.Printf("Imported: %s (%s)", p.ID, p.Title)
		imported++

		// Small delay to not overwhelm Firebase
		time.Sleep(50 * time.Millisecond)
	}

	log.Printf("Done! Imported: %d, Failed: %d", imported, failed)
}
