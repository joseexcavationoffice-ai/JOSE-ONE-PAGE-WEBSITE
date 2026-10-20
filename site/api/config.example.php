<?php
// Copy this file to config.php (same folder) and fill in the values. config.php is blocked from the web by .htaccess.
return [
    // Google reviews (Places API "New"): Google Cloud > APIs & Services > enable "Places API (New)" > create an API key
    // restricted to that API. Place ID of the Jose Excavation LLC Google Business Profile:
    // https://developers.google.com/maps/documentation/places/web-service/place-id
    // Until this is filled in, the page keeps its "be one of the first to review" card.
    'google_api_key'  => '',
    'google_place_id' => '',
];
