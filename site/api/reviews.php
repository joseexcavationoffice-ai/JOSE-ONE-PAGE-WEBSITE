<?php
// Latest Google reviews for the business, cached for 12 hours. Output shape matches renderReviews() in main.js.
// Google returns at most 5 reviews ("most relevant"); author names and the Google attribution must stay visible.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');

$cacheFile = __DIR__ . '/cache/reviews.json';
$ttl = 12 * 3600;

function finish(int $status, string $body): void {
    http_response_code($status);
    if ($status === 200) header('Cache-Control: public, max-age=3600');
    echo $body;
    exit;
}

if (is_file($cacheFile) && time() - filemtime($cacheFile) < $ttl) finish(200, (string) file_get_contents($cacheFile));

$cfg = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
if (empty($cfg['google_api_key']) || empty($cfg['google_place_id'])) finish(503, '{"error":"not configured"}');

$url = 'https://places.googleapis.com/v1/places/' . rawurlencode($cfg['google_place_id']) . '?languageCode=en';
$ctx = stream_context_create(['http' => [
    'timeout' => 8,
    'ignore_errors' => true,
    'header' => "X-Goog-Api-Key: {$cfg['google_api_key']}\r\nX-Goog-FieldMask: rating,userRatingCount,googleMapsUri,reviews\r\n",
]]);
$raw = @file_get_contents($url, false, $ctx);
$place = $raw ? json_decode($raw, true) : null;

if (!is_array($place) || isset($place['error'])) {
    // keep showing the last good copy rather than nothing
    if (is_file($cacheFile)) finish(200, (string) file_get_contents($cacheFile));
    finish(502, '{"error":"upstream"}');
}

$reviews = [];
foreach ($place['reviews'] ?? [] as $r) {
    $text = $r['text']['text'] ?? ($r['originalText']['text'] ?? '');
    if (trim($text) === '') continue;
    $reviews[] = [
        'author'     => $r['authorAttribution']['displayName'] ?? 'Google user',
        'author_url' => $r['authorAttribution']['uri'] ?? null,
        'photo'      => $r['authorAttribution']['photoUri'] ?? null,
        'rating'     => (int) ($r['rating'] ?? 5),
        'date'       => substr((string) ($r['publishTime'] ?? ''), 0, 10),
        'when'       => $r['relativePublishTimeDescription'] ?? null,
        'text'       => $text,
    ];
}

$out = json_encode([
    'source'  => 'google',
    'rating'  => $place['rating'] ?? null,
    'total'   => $place['userRatingCount'] ?? null,
    'url'     => $place['googleMapsUri'] ?? null,
    'reviews' => $reviews,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

if (!is_dir(__DIR__ . '/cache')) @mkdir(__DIR__ . '/cache', 0755);
@file_put_contents($cacheFile . '.tmp', $out) && @rename($cacheFile . '.tmp', $cacheFile);
finish(200, $out);
