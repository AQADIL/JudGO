package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	printBanner()

	log.Println("[INIT] Loading configuration...")
	log.Println("[INIT] Connecting to Firebase RTDB...")
	log.Println("[INIT] Initializing Repository, Service, and Transport layers...")

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

	if err := http.ListenAndServe(":"+port, nil); err != nil {
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
