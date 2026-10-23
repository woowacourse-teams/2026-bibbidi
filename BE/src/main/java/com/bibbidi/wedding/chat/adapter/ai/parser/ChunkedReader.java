package com.bibbidi.wedding.chat.adapter.ai.parser;

import java.io.Reader;
import java.util.Iterator;
import java.util.Objects;

final class ChunkedReader extends Reader {

    private final Iterator<String> chunks;
    private String chunk = "";
    private int position;

    ChunkedReader(Iterator<String> chunks) {
        this.chunks = chunks;
    }

    @Override
    public int read(char[] buffer, int offset, int length) {
        Objects.checkFromIndexSize(offset, length, buffer.length);
        if (length == 0) {
            return 0;
        }
        while (position == chunk.length()) {
            if (!chunks.hasNext()) {
                return -1;
            }
            chunk = chunks.next();
            position = 0;
        }
        int count = Math.min(length, chunk.length() - position);
        chunk.getChars(position, position + count, buffer, offset);
        position += count;
        return count;
    }

    @Override
    public void close() {
    }
}
