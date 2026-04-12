# Submission Playbook

## Goal

Get from `internally ready` to `publicly submitted` with the fewest moving parts and the least confusion.

## Canonical identity

- Track: `X Layer Arena`
- Project: `SkillMesh Revenue Mesh`
- Wallet: `0x90ec52fe001a5b59b356eb55ffb6931b7c37db26`

## Canonical proof set

- Registry: `0xAe0bCB2181ff57E344D65aFBB6B033acf799d345`
- Receipt: `0xbc8cdbc75105E6f25f886D9f3505784D5fdFeAd3`
- Mission proof tx: `0xbdc153b13c48fec7e2da104f90bdf9755d375b48524e6786784c15191469e50c`
- Receipt mint tx: `0xcfa37406418fd82eae96c254b55032b8fa304ee126be4acca9554b3ef8587268`
- Specialist settlement tx: `0x9c72cd4131f398f743bf4aa75033a1e42f04202cbf643fe69462d5fdc9678d05`

## Release order

### Step 1. Publish the repo

Do:

- create the public GitHub repository
- copy the final README in
- make sure `.env` is not present
- verify all public links still use `<<...>>` placeholders until the final URLs exist

Then fill:

- GitHub URL in `MOLTBOOK_POST.md`
- GitHub URL in `X_POST.md`
- GitHub URL in `FORM_TEMPLATE.md`
- GitHub URL in `README.md`

### Step 2. Capture the final demo

Use:

- `DEMO_SCRIPT.md`

Output:

- one `90-130 second` demo video

Then fill:

- Demo video URL in `README.md`
- Demo video URL in `MOLTBOOK_POST.md`
- Demo video URL in `X_POST.md`
- Demo video URL in `FORM_TEMPLATE.md`

### Step 3. Publish Moltbook

Use:

- `MOLTBOOK_POST.md`

Then fill:

- Moltbook URL in `README.md`
- Moltbook URL in `X_POST.md`
- Moltbook URL in `FORM_TEMPLATE.md`

### Step 4. Publish X

Use:

- `X_POST.md`

Then fill:

- X post URL in `README.md`
- X post URL in `MOLTBOOK_POST.md`
- X post URL in `FORM_TEMPLATE.md`

### Step 5. Submit the Google Form

Use:

- `FORM_TEMPLATE.md`

Only submit when:

- GitHub is public
- demo video works without login friction
- Moltbook link is live
- X link is live

### Step 6. Freeze the public surface

Do one last pass across:

- `README.md`
- `MOLTBOOK_POST.md`
- `X_POST.md`
- `FORM_TEMPLATE.md`

And confirm:

- one-line pitch is identical
- wallet address is identical
- contract addresses are identical
- canonical tx hashes are identical
- every public link resolves

## Final release check

- one-line pitch is identical everywhere
- wallet address is identical everywhere
- contract addresses are identical everywhere
- proof tx hashes are identical everywhere
- no secrets appear in screenshots, README, or API output

## If time remains

- add screenshots to the repo
- add one follow-up Moltbook update
- add one X thread after the launch post
