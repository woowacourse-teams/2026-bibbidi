answer=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--output-last-message' ]; then shift; answer="$1"; fi
  shift
done
if [ -n "$answer" ]; then
  printf '%s' '{"answer":"text","recommendedItemIds":[]}' > "$answer"
else
  printf '%s' '{"structured_output":{"answer":"text","recommendedItemIds":[]}}'
fi
