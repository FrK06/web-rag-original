import requests
from typing import Dict, List
import os

class WebSearcher:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.cse_id = os.getenv("GOOGLE_CSE_ID")
        self.endpoint = "https://www.googleapis.com/customsearch/v1"

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        params = {
            "key": self.api_key,
            "cx": self.cse_id,
            "q": query,
            "num": max_results,
            "lr": "lang_en",  # English results only
            "safe": "active"  # Filter explicit content
        }

        time_fallback = [
            {"link": "https://www.timeanddate.com/worldclock/", "title": "Time and Date", "snippet": "Current time reference"},
            {"link": "https://www.worldtimebuddy.com/", "title": "World Time Buddy", "snippet": "Global time zones"},
        ]

        try:
            response = requests.get(self.endpoint, params=params)
            response.raise_for_status()
            results = response.json()

            if 'items' in results and results['items']:
                return [
                    {
                        "link": item["link"],
                        "title": item["title"],
                        "snippet": item["snippet"],
                        "provider": "Google"
                    }
                    for item in results["items"]
                ]
            else:
                return []  # No results found
        except Exception as e:
            print(f"Google search error: {str(e)}")
            # Fallback to time-related sites if query is time-related
            if any(word in query.lower() for word in ['time', 'date', 'timezone', 'clock']):
                return time_fallback
            else:
                return []