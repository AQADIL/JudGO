package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	firebaseRepo "github.com/AQADIL/JudGO/internal/repository/firebase"
	"github.com/AQADIL/JudGO/internal/service"
	"github.com/AQADIL/JudGO/internal/transport/rest"
	firebaseClient "github.com/AQADIL/JudGO/pkg/client/firebase"
)

func main() {
	printBanner()

	log.Println("[INIT] Loading configuration...")
	log.Println("[INIT] Connecting to Firebase RTDB...")
	dbURL := strings.TrimSpace(os.Getenv("FIREBASE_DB_URL"))
	if dbURL == "" {
		log.Fatal("[ERROR] FIREBASE_DB_URL is required")
	}
	keyPath := strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"))
	app, err := firebaseClient.InitApp(keyPath, dbURL)
	if err != nil {
		log.Fatalf("[ERROR] Unable to init Firebase: %v", err)
	}
	db, err := app.Database(context.Background())
	if err != nil {
		log.Fatalf("[ERROR] Unable to init Firebase DB: %v", err)
	}
	fbAuth, err := firebaseClient.InitAuthClient(app)
	if err != nil {
		log.Fatalf("[ERROR] Unable to init Firebase Auth client: %v", err)
	}
	log.Println("Connected to Firebase")

	log.Println("[INIT] Initializing Repository, Service, and Transport layers...")
	matchRepo := firebaseRepo.NewFirebaseMatchRepository(db)
	roomRepo := firebaseRepo.NewFirebaseRoomRepository(db)
	roomGameRepo := firebaseRepo.NewFirebaseRoomGameRepository(db)
	problemRepo := firebaseRepo.NewFirebaseProblemRepository(db)
	userRepo := firebaseRepo.NewFirebaseUserRepository(db)
	practiceRepo := firebaseRepo.NewFirebasePracticeRepository(db)
	matchService := service.NewMatchService(matchRepo)
	roomService := service.NewRoomService(roomRepo)
	problemService := service.NewProblemService(problemRepo)
	judgeService := service.NewJudgeService(problemService)
	roomGameService := service.NewRoomGameService(roomGameRepo, problemService, judgeService)
	authService := service.NewAuthService(userRepo)
	handler := rest.NewHandler(matchService, roomService, roomGameService, problemService, judgeService, authService, fbAuth, userRepo, practiceRepo)
	rest.RegisterRoutes(http.DefaultServeMux, handler)

	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "alive", "project": "JudGO", "time": "` + time.Now().String() + `"}`))
	})

	log.Printf("[READY] JudGO Server is running on http://localhost:%s\n", port)

	addr := ":" + port
	if host := os.Getenv("HOST"); host != "" {
		addr = host + ":" + port
	} else {
		addr = "0.0.0.0:" + port
	}
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("[ERROR] Server failed to start: %v", err)
	}
}

func printBanner() {
	fmt.Println(`
       __          __  __________ 
      / /_  ______/ / / ____/ __ \
 __  / / / / / __  / / / __/ / / /
/ /_/ / /_/ / /_/ / / /_/ / /_/ / 
\____/\__,_/\__,_/  \____/\____/  
                                  
   >> Go Contester Platform | Backend  
	`)
}
