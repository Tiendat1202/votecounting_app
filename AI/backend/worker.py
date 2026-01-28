# backend/worker.py

from rq import Worker, Queue
from redis import Redis

from backend.config import REDIS_URL

listen = ["ballot"]  # phải khớp với queue name trong app.py (Queue("ballot", ...))

def main():
    redis_conn = Redis.from_url(REDIS_URL)
    queues = [Queue(name, connection=redis_conn) for name in listen]

    worker = Worker(queues, connection=redis_conn)
    print("[WORKER] Started listening for jobs...")
    worker.work()

if __name__ == "__main__":
    main()