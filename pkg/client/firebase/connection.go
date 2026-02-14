package firebase

import (
	"context"
	"fmt"
	"os"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"firebase.google.com/go/v4/db"
	"google.golang.org/api/option"
)

func credsOption(keyPath string) (option.ClientOption, error) {
	keyPath = strings.TrimSpace(keyPath)
	if keyPath == "" {
		keyPath = strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"))
	}
	if keyPath != "" {
		return option.WithCredentialsFile(keyPath), nil
	}

	jsonCreds := strings.TrimSpace(os.Getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
	if jsonCreds != "" {
		return option.WithCredentialsJSON([]byte(jsonCreds)), nil
	}

	return nil, fmt.Errorf("firebase credentials are not configured (set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON)")
}

func InitDB(keyPath string, dbURL string) (*db.Client, error) {
	ctx := context.Background()

	conf := &firebase.Config{DatabaseURL: dbURL}
	opt, err := credsOption(keyPath)
	if err != nil {
		return nil, err
	}
	app, err := firebase.NewApp(ctx, conf, opt)
	if err != nil {
		return nil, err
	}

	client, err := app.Database(ctx)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func InitApp(keyPath string, dbURL string) (*firebase.App, error) {
	ctx := context.Background()

	conf := &firebase.Config{DatabaseURL: dbURL}
	opt, err := credsOption(keyPath)
	if err != nil {
		return nil, err
	}
	app, err := firebase.NewApp(ctx, conf, opt)
	if err != nil {
		return nil, err
	}
	return app, nil
}

func InitAuthClient(app *firebase.App) (*auth.Client, error) {
	ctx := context.Background()
	return app.Auth(ctx)
}
