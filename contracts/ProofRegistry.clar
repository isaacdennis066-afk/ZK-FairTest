(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-CERT-ID u101)
(define-constant ERR-INVALID-TEST-ID u102)
(define-constant ERR-INVALID-PROOF-HASH u103)
(define-constant ERR-PROOF-ALREADY-EXISTS u104)
(define-constant ERR-PROOF-NOT-FOUND u105)
(define-constant ERR-PROOF-REVOKED u106)
(define-constant ERR-INVALID-STAKE u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MAX-PROOFS u110)
(define-constant ERR-MAX-PROOFS-EXCEEDED u111)
(define-constant ERR-INVALID-UPDATE-PARAM u112)
(define-constant ERR-UPDATE-NOT-ALLOWED u113)
(define-constant ERR-INVALID-SCORE-RANGE u114)
(define-constant ERR-INVALID-PROOF-LENGTH u115)
(define-constant ERR-INVALID-EXPIRY u116)
(define-constant ERR-PROOF-EXPIRED u117)
(define-constant ERR-INVALID-VERIFIER u118)
(define-constant ERR-INVALID-METADATA u119)
(define-constant ERR-INVALID-STATUS u120)

(define-data-var next-proof-id uint u0)
(define-data-var max-proofs uint u10000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var min-stake uint u100)
(define-data-var max-stake uint u10000)
(define-data-var proof-expiry uint u525600)

(define-map proofs
  { cert-id: uint, test-id: uint }
  {
    proof-hash: (string-ascii 64),
    timestamp: uint,
    staked: uint,
    revoked: bool,
    score: uint,
    expiry: uint,
    verifier: principal,
    metadata: (string-utf8 256),
    status: bool
  }
)

(define-map proofs-by-hash
  (string-ascii 64)
  { cert-id: uint, test-id: uint }
)

(define-map proof-updates
  { cert-id: uint, test-id: uint }
  {
    update-hash: (string-ascii 64),
    update-timestamp: uint,
    updater: principal,
    update-score: uint,
    update-metadata: (string-utf8 256)
  }
)

(define-read-only (get-proof (cert-id uint) (test-id uint))
  (map-get? proofs { cert-id: cert-id, test-id: test-id })
)

(define-read-only (get-proof-updates (cert-id uint) (test-id uint))
  (map-get? proof-updates { cert-id: cert-id, test-id: test-id })
)

(define-read-only (is-proof-registered (proof-hash (string-ascii 64)))
  (is-some (map-get? proofs-by-hash proof-hash))
)

(define-private (validate-cert-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-CERT-ID))
)

(define-private (validate-test-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-TEST-ID))
)

(define-private (validate-proof-hash (hash (string-ascii 64)))
  (if (and (> (len hash) u0) (<= (len hash) u64))
      (ok true)
      (err ERR-INVALID-PROOF-HASH))
)

(define-private (validate-stake (amount uint))
  (if (and (>= amount (var-get min-stake)) (<= amount (var-get max-stake)))
      (ok true)
      (err ERR-INVALID-STAKE))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-score (score uint))
  (if (<= score u100)
      (ok true)
      (err ERR-INVALID-SCORE-RANGE))
)

(define-private (validate-expiry (exp uint))
  (if (> exp u0)
      (ok true)
      (err ERR-INVALID-EXPIRY))
)

(define-private (validate-verifier (ver principal))
  (if (not (is-eq ver tx-sender))
      (ok true)
      (err ERR-INVALID-VERIFIER))
)

(define-private (validate-metadata (meta (string-utf8 256)))
  (if (<= (len meta) u256)
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-proofs (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-MAX-PROOFS))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-proofs new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (set-min-stake (new-min uint))
  (begin
    (asserts! (> new-min u0) (err ERR-INVALID-STAKE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set min-stake new-min)
    (ok true)
  )
)

(define-public (set-max-stake (new-max uint))
  (begin
    (asserts! (> new-max (var-get min-stake)) (err ERR-INVALID-STAKE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-stake new-max)
    (ok true)
  )
)

(define-public (set-proof-expiry (new-expiry uint))
  (begin
    (asserts! (> new-expiry u0) (err ERR-INVALID-EXPIRY))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set proof-expiry new-expiry)
    (ok true)
  )
)

(define-public (submit-proof
  (cert-id uint)
  (test-id uint)
  (proof-hash (string-ascii 64))
  (stake uint)
  (score uint)
  (metadata (string-utf8 256))
)
  (let (
        (next-id (var-get next-proof-id))
        (current-max (var-get max-proofs))
        (authority (var-get authority-contract))
        (expiry (+ block-height (var-get proof-expiry)))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-PROOFS-EXCEEDED))
    (try! (validate-cert-id cert-id))
    (try! (validate-test-id test-id))
    (try! (validate-proof-hash proof-hash))
    (try! (validate-stake stake))
    (try! (validate-score score))
    (try! (validate-metadata metadata))
    (asserts! (is-none (map-get? proofs-by-hash proof-hash)) (err ERR-PROOF-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set proofs { cert-id: cert-id, test-id: test-id }
      {
        proof-hash: proof-hash,
        timestamp: block-height,
        staked: stake,
        revoked: false,
        score: score,
        expiry: expiry,
        verifier: tx-sender,
        metadata: metadata,
        status: true
      }
    )
    (map-set proofs-by-hash proof-hash { cert-id: cert-id, test-id: test-id })
    (var-set next-proof-id (+ next-id u1))
    (print { event: "proof-submitted", cert-id: cert-id, test-id: test-id })
    (ok cert-id)
  )
)

(define-public (update-proof
  (cert-id uint)
  (test-id uint)
  (update-hash (string-ascii 64))
  (update-score uint)
  (update-metadata (string-utf8 256))
)
  (let ((proof (map-get? proofs { cert-id: cert-id, test-id: test-id })))
    (match proof
      p
        (begin
          (asserts! (is-eq (get verifier p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-proof-hash update-hash))
          (try! (validate-score update-score))
          (try! (validate-metadata update-metadata))
          (let ((old-hash (get proof-hash p)))
            (if (is-eq old-hash update-hash)
                (ok true)
                (begin
                  (map-delete proofs-by-hash old-hash)
                  (map-set proofs-by-hash update-hash { cert-id: cert-id, test-id: test-id })
                  (ok true)
                )
            )
          )
          (map-set proofs { cert-id: cert-id, test-id: test-id }
            {
              proof-hash: update-hash,
              timestamp: block-height,
              staked: (get staked p),
              revoked: (get revoked p),
              score: update-score,
              expiry: (get expiry p),
              verifier: (get verifier p),
              metadata: update-metadata,
              status: (get status p)
            }
          )
          (map-set proof-updates { cert-id: cert-id, test-id: test-id }
            {
              update-hash: update-hash,
              update-timestamp: block-height,
              updater: tx-sender,
              update-score: update-score,
              update-metadata: update-metadata
            }
          )
          (print { event: "proof-updated", cert-id: cert-id, test-id: test-id })
          (ok true)
        )
      (err ERR-PROOF-NOT-FOUND)
    )
  )
)

(define-public (revoke-proof (cert-id uint) (test-id uint))
  (let ((proof (map-get? proofs { cert-id: cert-id, test-id: test-id })))
    (match proof
      p
        (begin
          (asserts! (is-eq (get verifier p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get revoked p)) (err ERR-PROOF-REVOKED))
          (map-set proofs { cert-id: cert-id, test-id: test-id }
            (merge p { revoked: true, status: false })
          )
          (print { event: "proof-revoked", cert-id: cert-id, test-id: test-id })
          (ok true)
        )
      (err ERR-PROOF-NOT-FOUND)
    )
  )
)

(define-public (validate-proof (cert-id uint) (test-id uint) (expected-hash (string-ascii 64)))
  (let ((proof (unwrap! (map-get? proofs { cert-id: cert-id, test-id: test-id }) (err ERR-PROOF-NOT-FOUND))))
    (asserts! (not (get revoked proof)) (err ERR-PROOF-REVOKED))
    (asserts! (is-eq (get proof-hash proof) expected-hash) (err ERR-INVALID-PROOF-HASH))
    (asserts! (< block-height (get expiry proof)) (err ERR-PROOF-EXPIRED))
    (ok (get score proof))
  )
)

(define-public (get-proof-count)
  (ok (var-get next-proof-id))
)

(define-public (check-proof-existence (proof-hash (string-ascii 64)))
  (ok (is-proof-registered proof-hash))
)