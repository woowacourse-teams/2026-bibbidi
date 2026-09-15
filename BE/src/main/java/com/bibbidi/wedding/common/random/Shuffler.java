package com.bibbidi.wedding.common.random;

import java.util.List;

public interface Shuffler {

    <T> List<T> shuffle(List<T> values);
}
