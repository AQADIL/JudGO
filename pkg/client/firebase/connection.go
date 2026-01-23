package firebase

import (
	"context"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/db"
	"google.golang.org/api/option"
)

// InitDB initializes a connection to Firebase Realtime Database using the
// provided service account key file and database URL. It returns a db.Client
// instance that can be used for interacting with the RTDB.
func InitDB(keyPath string, dbURL string) (*db.Client, error) {
	ctx := context.Background()

	conf := &firebase.Config{DatabaseURL: dbURL}
	app, err := firebase.NewApp(ctx, conf, option.WithCredentialsFile(keyPath))
	if err != nil {
		return nil, err
	}

	client, err := app.Database(ctx)
	if err != nil {
		return nil, err
	}

	return client, nil
}
