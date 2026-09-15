package com.bibbidi.wedding.checklist.util;

import java.util.List;

public interface Shuffler {

    <T> List<T> shuffle(List<T> values);
}
