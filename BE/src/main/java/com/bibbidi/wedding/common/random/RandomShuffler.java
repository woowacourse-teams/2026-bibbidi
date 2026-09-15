package com.bibbidi.wedding.common.random;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class RandomShuffler implements Shuffler {

    @Override
    public <T> List<T> shuffle(List<T> values) {
        List<T> shuffled = new ArrayList<>(values);
        Collections.shuffle(shuffled);
        return shuffled;
    }
}
